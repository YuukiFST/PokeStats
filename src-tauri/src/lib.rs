use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

static WEBVIEW_READY: AtomicBool = AtomicBool::new(false);
static WINDOW_OPAQUE: AtomicBool = AtomicBool::new(false);
static BOOT_START: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

/// If JS never reports a painted frame (crash, blocked script), reveal anyway.
const REVEAL_FALLBACK_MS: u64 = 2000;

fn boot_log(msg: &str) {
  if std::env::var_os("POKESTATS_BOOT_LOG").is_none() {
    return;
  }
  use std::io::Write;
  let ms = BOOT_START.get().map(|s| s.elapsed().as_millis()).unwrap_or(0);
  if let Ok(mut f) = std::fs::OpenOptions::new()
    .create(true)
    .append(true)
    .open(std::env::temp_dir().join("pokestats-boot.log"))
  {
    let _ = writeln!(f, "{ms:>6} ms  {msg}");
  }
}

/// How long after show() we wait for JS to report a presented frame before
/// making the window opaque regardless.
const OPAQUE_FALLBACK_MS: u64 = 150;

/// Show the window at alpha 0. WebView2 only presents frames for a visible
/// HWND, so a plain show() puts the bare window background on screen one or
/// two vsyncs before the first webview frame lands. Transparent-then-opaque
/// lets the webview present first; `frame_presented` (or the fallback timer)
/// then snaps alpha to 255.
fn reveal_webview(app: &tauri::AppHandle, reason: &'static str) {
  if WEBVIEW_READY.swap(true, Ordering::SeqCst) {
    return;
  }
  boot_log(&format!("reveal webview ({reason})"));
  let app = app.clone();
  let _ = app.clone().run_on_main_thread(move || {
    if let Some(win) = app.get_window("main") {
      #[cfg(target_os = "windows")]
      if let Ok(hwnd) = win.hwnd() {
        layered::set_alpha(hwnd.0 as isize, 0);
      }
      let _ = win.show();
      let _ = win.set_focus();
      #[cfg(target_os = "windows")]
      {
        let handle = app.clone();
        std::thread::spawn(move || {
          std::thread::sleep(std::time::Duration::from_millis(OPAQUE_FALLBACK_MS));
          make_opaque(&handle, "fallback");
        });
      }
      #[cfg(not(target_os = "windows"))]
      WINDOW_OPAQUE.store(true, Ordering::SeqCst);
    }
  });
}

fn make_opaque(app: &tauri::AppHandle, reason: &'static str) {
  if WINDOW_OPAQUE.swap(true, Ordering::SeqCst) {
    return;
  }
  boot_log(&format!("window opaque ({reason})"));
  let app = app.clone();
  let _ = app.clone().run_on_main_thread(move || {
    #[cfg(target_os = "windows")]
    if let Some(win) = app.get_window("main") {
      if let Ok(hwnd) = win.hwnd() {
        layered::clear(hwnd.0 as isize);
      }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = app;
  });
}

#[tauri::command]
fn shell_ready(app: tauri::AppHandle) {
  reveal_webview(&app, "js");
}

/// JS calls this after the first animation frame that ran with the document
/// visible, i.e. after WebView2 has presented at least one frame post-show.
#[tauri::command]
fn frame_presented(app: tauri::AppHandle) {
  make_opaque(&app, "js");
}

/// JS-side boot marks land in the same POKESTATS_BOOT_LOG file as the native ones.
#[tauri::command]
fn boot_mark(name: String) {
  boot_log(&format!("js: {name}"));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  BOOT_START.get_or_init(std::time::Instant::now);
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // Hidden until JS reports the Dex is painted (`shell_ready`), so the first
      // visible frame is the final UI. WebView2 only presents frames for an
      // on-screen visible window: DWM cloaking and off-screen parking were both
      // measured and neither pre-renders the page, so a plain show() it is.
      let window = tauri::window::WindowBuilder::new(app, "main")
        .title("PokeStats")
        .inner_size(1280.0, 800.0)
        .min_inner_size(1024.0, 640.0)
        .resizable(true)
        .theme(Some(tauri::Theme::Dark))
        .background_color(tauri::window::Color(0x0a, 0x0a, 0x0a, 0xff))
        .visible(false)
        .build()?;
      apply_caption(&window);
      boot_log("window created hidden");
      let size = window.inner_size()?;
      #[cfg(windows)]
      let webview_builder = tauri::webview::WebviewBuilder::new("main", tauri::WebviewUrl::default())
        .auto_resize()
        .additional_browser_args(
          "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling",
        );
      #[cfg(not(windows))]
      let webview_builder = tauri::webview::WebviewBuilder::new("main", tauri::WebviewUrl::default()).auto_resize();
      let _webview = window.add_child(
        webview_builder,
        tauri::LogicalPosition::new(0.0, 0.0),
        size,
      )?;
      boot_log("webview attached");
      let handle = app.handle().clone();
      std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(REVEAL_FALLBACK_MS));
        reveal_webview(&handle, "fallback");
      });
      Ok(())
    })
    .on_page_load(|_webview, payload| {
      if payload.url().as_str().starts_with("about:") {
        return;
      }
      if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
        boot_log("page finished");
      }
    })
    .invoke_handler(tauri::generate_handler![shell_ready, frame_presented, boot_mark])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(target_os = "windows")]
mod layered {
  const GWL_EXSTYLE: i32 = -20;
  const WS_EX_LAYERED: isize = 0x0008_0000;
  const LWA_ALPHA: u32 = 0x2;

  #[link(name = "user32")]
  extern "system" {
    fn GetWindowLongPtrW(hwnd: isize, index: i32) -> isize;
    fn SetWindowLongPtrW(hwnd: isize, index: i32, value: isize) -> isize;
    fn SetLayeredWindowAttributes(hwnd: isize, key: u32, alpha: u8, flags: u32) -> i32;
  }

  pub fn set_alpha(hwnd: isize, alpha: u8) {
    unsafe {
      let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
      SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex | WS_EX_LAYERED);
      SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA);
    }
  }

  /// Back to a normal (non-layered) window: cheaper for DWM than a layered
  /// window at alpha 255, and identical on screen.
  pub fn clear(hwnd: isize) {
    unsafe {
      SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);
      let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
      SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex & !WS_EX_LAYERED);
    }
  }
}

fn apply_caption(win: &tauri::Window) {
  #[cfg(target_os = "windows")]
  {
    const DWMWA_USE_IMMERSIVE_DARK_MODE: u32 = 20;
    const DWMWA_CAPTION_COLOR: u32 = 35;

    #[link(name = "dwmapi")]
    extern "system" {
      fn DwmSetWindowAttribute(hwnd: isize, attr: u32, value: *const core::ffi::c_void, size: u32) -> i32;
    }

    if let Ok(hwnd) = win.hwnd() {
      let hwnd = hwnd.0 as isize;
      let dark_mode: i32 = 1;
      let caption: u32 = 0x000000;
      unsafe {
        DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, (&dark_mode as *const i32).cast(), 4);
        DwmSetWindowAttribute(hwnd, DWMWA_CAPTION_COLOR, (&caption as *const u32).cast(), 4);
      }
    }
  }
  #[cfg(not(target_os = "windows"))]
  {
    let _ = win;
  }
}

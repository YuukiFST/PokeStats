use std::sync::atomic::{AtomicBool, Ordering};
use tauri::webview::PageLoadEvent;
use tauri::Manager;

static WEBVIEW_READY: AtomicBool = AtomicBool::new(false);
static PAGE_FINISHED: AtomicBool = AtomicBool::new(false);
static BOOT_START: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

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

fn reveal_webview(app: &tauri::AppHandle, reason: &'static str) {
  if WEBVIEW_READY.swap(true, Ordering::SeqCst) {
    return;
  }
  boot_log(&format!("reveal webview ({reason})"));
  let app = app.clone();
  let _ = app.clone().run_on_main_thread(move || {
    #[cfg(target_os = "windows")]
    if let Some(win) = app.get_window("main") {
      if let Ok(hwnd) = win.hwnd() {
        winpaint::finish(hwnd.0 as isize);
      }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = &app;
  });
}

#[tauri::command]
fn shell_ready(app: tauri::AppHandle) {
  reveal_webview(&app, "js");
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
      let window = tauri::window::WindowBuilder::new(app, "main")
        .title("PokeStats")
        .inner_size(1280.0, 800.0)
        .min_inner_size(1024.0, 640.0)
        .resizable(true)
        .theme(Some(tauri::Theme::Dark))
        .background_color(tauri::window::Color(0x0a, 0x0a, 0x0a, 0xff))
        .visible(true)
        .build()?;
      apply_caption(&window);
      #[cfg(target_os = "windows")]
      if let Ok(hwnd) = window.hwnd() {
        winpaint::install(hwnd.0 as isize);
      }
      boot_log("window shown, shell installed");
      let size = window.inner_size()?;
      let _webview = window.add_child(
        tauri::webview::WebviewBuilder::new("main", tauri::WebviewUrl::default()).auto_resize(),
        tauri::LogicalPosition::new(0.0, 0.0),
        size,
      )?;
      boot_log("webview attached");
      Ok(())
    })
    .on_page_load(|webview, payload| {
      let url = payload.url().as_str();
      if url.starts_with("about:") {
        return;
      }
      #[cfg(target_os = "windows")]
      {
        let Ok(hwnd) = webview.window().hwnd() else {
          return;
        };
        let hwnd = hwnd.0 as isize;
        match payload.event() {
          PageLoadEvent::Started => {
            if !WEBVIEW_READY.load(Ordering::SeqCst) {
              hide_child_windows(hwnd);
              winpaint::request_repaint(hwnd);
            }
          }
          PageLoadEvent::Finished => {
            PAGE_FINISHED.store(true, Ordering::SeqCst);
            boot_log("page finished");
            winpaint::start_fallback_timer(hwnd);
          }
        }
      }
      #[cfg(not(target_os = "windows"))]
      {
        let _ = (webview, payload);
      }
    })
    .invoke_handler(tauri::generate_handler![shell_ready])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
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
      unsafe {
        let dark_mode: i32 = 1;
        DwmSetWindowAttribute(hwnd.0 as isize, DWMWA_USE_IMMERSIVE_DARK_MODE, (&dark_mode as *const i32).cast(), std::mem::size_of::<i32>() as u32);
        let caption: u32 = 0x000000;
        DwmSetWindowAttribute(hwnd.0 as isize, DWMWA_CAPTION_COLOR, (&caption as *const u32).cast(), std::mem::size_of::<i32>() as u32);
      }
    }
  }
  #[cfg(not(target_os = "windows"))]
  {
    let _ = win;
  }
}

#[cfg(target_os = "windows")]
mod winpaint {
  use super::WEBVIEW_READY;
  use std::sync::atomic::Ordering;

  #[repr(C)]
  struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
  }

  #[repr(C)]
  struct PaintStruct {
    hdc: isize,
    erase: i32,
    paint: Rect,
    restore: i32,
    inc_update: i32,
    reserved: [u8; 32],
  }

  const SW_HIDE: i32 = 0;
  const SW_SHOW: i32 = 5;
  const TRANSPARENT: i32 = 1;
  const DT_SINGLELINE: u32 = 0x20;
  const DT_VCENTER: u32 = 0x04;
  const DT_NOPREFIX: u32 = 0x100;
  const WM_PAINT: u32 = 0x000F;
  const WM_ERASEBKGND: u32 = 0x0014;
  const WM_PARENTNOTIFY: u32 = 0x0210;
  const WM_CREATE: u32 = 0x0001;
  const RDW_INVALIDATE: u32 = 0x0001;
  const RDW_ERASE: u32 = 0x0004;
  const RDW_UPDATENOW: u32 = 0x0100;
  const SUBCLASS_ID: usize = 0x504B;
  const TIMER_HIDE: usize = 1;
  const TIMER_FALLBACK: usize = 2;

  type SubclassProc = unsafe extern "system" fn(isize, u32, usize, isize, usize, usize) -> isize;

  #[link(name = "comctl32")]
  extern "system" {
    fn SetWindowSubclass(hwnd: isize, proc_: SubclassProc, id: usize, refdata: usize) -> i32;
    fn RemoveWindowSubclass(hwnd: isize, proc_: SubclassProc, id: usize) -> i32;
    fn DefSubclassProc(hwnd: isize, msg: u32, wparam: usize, lparam: isize) -> isize;
  }

  #[link(name = "user32")]
  extern "system" {
    fn GetClientRect(hwnd: isize, rc: *mut Rect) -> i32;
    fn FillRect(hdc: isize, rc: *const Rect, brush: isize) -> i32;
    fn DrawTextW(hdc: isize, text: *const u16, count: i32, rc: *mut Rect, format: u32) -> i32;
    fn EnumChildWindows(hwnd: isize, cb: Option<unsafe extern "system" fn(isize, isize) -> i32>, lparam: isize) -> i32;
    fn ShowWindow(hwnd: isize, cmd: i32) -> i32;
    fn SetTimer(hwnd: isize, id: usize, ms: u32, cb: Option<unsafe extern "system" fn(isize, u32, usize, u32)>) -> usize;
    fn KillTimer(hwnd: isize, id: usize) -> i32;
    fn GetDpiForWindow(hwnd: isize) -> u32;
    fn SetTextColor(hdc: isize, color: u32) -> u32;
    fn SetBkMode(hdc: isize, mode: i32) -> i32;
    fn BeginPaint(hwnd: isize, ps: *mut PaintStruct) -> isize;
    fn EndPaint(hwnd: isize, ps: *const PaintStruct) -> i32;
    fn InvalidateRect(hwnd: isize, rc: *const Rect, erase: i32) -> i32;
    fn RedrawWindow(hwnd: isize, rc: *const Rect, rgn: isize, flags: u32) -> i32;
  }

  #[link(name = "gdi32")]
  extern "system" {
    fn CreateSolidBrush(color: u32) -> isize;
    fn DeleteObject(obj: isize) -> i32;
    fn CreateFontW(
      height: i32,
      width: i32,
      escapement: i32,
      orientation: i32,
      weight: i32,
      italic: u32,
      underline: u32,
      strikeout: u32,
      charset: u32,
      out_precision: u32,
      clip_precision: u32,
      quality: u32,
      pitch_and_family: u32,
      face: *const u16,
    ) -> isize;
    fn SelectObject(hdc: isize, obj: isize) -> isize;
  }

  unsafe extern "system" fn each_child_hide(hwnd: isize, _: isize) -> i32 {
    ShowWindow(hwnd, SW_HIDE);
    1
  }

  unsafe extern "system" fn each_child_show(hwnd: isize, _: isize) -> i32 {
    ShowWindow(hwnd, SW_SHOW);
    1
  }

  pub fn hide_child_windows(hwnd: isize) {
    unsafe {
      EnumChildWindows(hwnd, Some(each_child_hide), 0);
    }
  }

  pub fn show_child_windows(hwnd: isize) {
    unsafe {
      EnumChildWindows(hwnd, Some(each_child_show), 0);
    }
  }

  unsafe extern "system" fn shell_proc(hwnd: isize, msg: u32, wparam: usize, lparam: isize, _id: usize, _ref: usize) -> isize {
    if WEBVIEW_READY.load(Ordering::SeqCst) {
      return DefSubclassProc(hwnd, msg, wparam, lparam);
    }
    match msg {
      WM_ERASEBKGND => {
        paint_shell_to(hwnd, wparam as isize);
        1
      }
      WM_PAINT => {
        let mut ps: PaintStruct = std::mem::zeroed();
        let hdc = BeginPaint(hwnd, &mut ps);
        if hdc != 0 {
          paint_shell_to(hwnd, hdc);
        }
        EndPaint(hwnd, &ps);
        DefSubclassProc(hwnd, msg, wparam, lparam)
      }
      WM_PARENTNOTIFY if (wparam & 0xFFFF) as u32 == WM_CREATE => {
        ShowWindow(lparam, SW_HIDE);
        DefSubclassProc(hwnd, msg, wparam, lparam)
      }
      _ => DefSubclassProc(hwnd, msg, wparam, lparam),
    }
  }

  unsafe extern "system" fn on_hide_timer(hwnd: isize, _: u32, id: usize, _: u32) {
    if WEBVIEW_READY.load(Ordering::SeqCst) {
      KillTimer(hwnd, id);
      return;
    }
    EnumChildWindows(hwnd, Some(each_child_hide), 0);
  }

  unsafe extern "system" fn on_fallback_timer(hwnd: isize, _: u32, id: usize, _: u32) {
    KillTimer(hwnd, id);
    if !WEBVIEW_READY.load(Ordering::SeqCst) {
      super::boot_log("reveal webview (fallback)");
      WEBVIEW_READY.store(true, Ordering::SeqCst);
      finish(hwnd);
    }
  }

  pub fn install(hwnd: isize) {
    unsafe {
      SetWindowSubclass(hwnd, shell_proc, SUBCLASS_ID, 0);
      EnumChildWindows(hwnd, Some(each_child_hide), 0);
      SetTimer(hwnd, TIMER_HIDE, 50, Some(on_hide_timer));
      RedrawWindow(hwnd, std::ptr::null(), 0, RDW_INVALIDATE | RDW_ERASE | RDW_UPDATENOW);
    }
  }

  pub fn request_repaint(hwnd: isize) {
    unsafe {
      InvalidateRect(hwnd, std::ptr::null(), 1);
    }
  }

  pub fn start_fallback_timer(hwnd: isize) {
    unsafe {
      SetTimer(hwnd, TIMER_FALLBACK, 2500, Some(on_fallback_timer));
    }
  }

  pub fn finish(hwnd: isize) {
    unsafe {
      KillTimer(hwnd, TIMER_HIDE);
      KillTimer(hwnd, TIMER_FALLBACK);
      RemoveWindowSubclass(hwnd, shell_proc, SUBCLASS_ID);
      show_child_windows(hwnd);
      InvalidateRect(hwnd, std::ptr::null(), 1);
    }
  }

  fn rgb(r: u8, g: u8, b: u8) -> u32 {
    u32::from(r) | (u32::from(g) << 8) | (u32::from(b) << 16)
  }

  fn fill(hdc: isize, rc: &Rect, color: u32) {
    unsafe {
      let brush = CreateSolidBrush(color);
      FillRect(hdc, rc, brush);
      DeleteObject(brush);
    }
  }

  fn text(hdc: isize, label: &str, mut rc: Rect, color: u32) {
    let mut wide: Vec<u16> = label.encode_utf16().collect();
    wide.push(0);
    unsafe {
      SetBkMode(hdc, TRANSPARENT);
      SetTextColor(hdc, color);
      DrawTextW(hdc, wide.as_ptr(), -1, &mut rc, DT_SINGLELINE | DT_VCENTER | DT_NOPREFIX);
    }
  }

  fn paint_shell_to(hwnd: isize, hdc: isize) {
    unsafe {
      if hdc == 0 {
        return;
      }
      let mut client = Rect { left: 0, top: 0, right: 0, bottom: 0 };
      GetClientRect(hwnd, &mut client);
      let dpi = GetDpiForWindow(hwnd).max(96);
      let s = dpi as i32;
      let px = |logical: i32| logical * s / 96;

      fill(hdc, &client, rgb(0x0a, 0x0a, 0x0a));
      let side = px(200);
      fill(
        hdc,
        &Rect { left: 0, top: 0, right: side, bottom: client.bottom },
        rgb(0, 0, 0),
      );
      fill(
        hdc,
        &Rect { left: side, top: 0, right: side + 1, bottom: client.bottom },
        rgb(0x2e, 0x2e, 0x2e),
      );
      let head = px(48);
      fill(
        hdc,
        &Rect { left: 0, top: head, right: side, bottom: head + 1 },
        rgb(0x2e, 0x2e, 0x2e),
      );

      let mut segoe: Vec<u16> = "Segoe UI".encode_utf16().collect();
      segoe.push(0);
      let font = CreateFontW(-px(14), 0, 0, 0, 600, 0, 0, 0, 1, 0, 0, 5, 0, segoe.as_ptr());
      let old = SelectObject(hdc, font);
      text(hdc, "PokeStats", Rect { left: px(16), top: 0, right: side - px(40), bottom: head }, rgb(0xed, 0xed, 0xed));
      text(hdc, "v2", Rect { left: side - px(36), top: 0, right: side - px(12), bottom: head }, rgb(0x8f, 0x8f, 0x8f));

      let nav = ["Dex", "Moves", "Types", "Items", "Natures", "Compare", "Teams", "Favorites", "Settings"];
      let mut y = head + px(8);
      let row = px(28);
      for (i, label) in nav.iter().enumerate() {
        let color = if i == 0 { rgb(0xed, 0xed, 0xed) } else { rgb(0xa0, 0xa0, 0xa0) };
        text(hdc, label, Rect { left: px(16), top: y, right: side - px(8), bottom: y + row }, color);
        y += row;
      }

      let tabs = px(36);
      fill(
        hdc,
        &Rect { left: side, top: 0, right: client.right, bottom: tabs },
        rgb(0, 0, 0),
      );
      fill(
        hdc,
        &Rect { left: side, top: tabs, right: client.right, bottom: tabs + 1 },
        rgb(0x2e, 0x2e, 0x2e),
      );
      text(hdc, "Dex", Rect { left: side + px(12), top: px(6), right: side + px(80), bottom: tabs }, rgb(0xed, 0xed, 0xed));
      let search = Rect {
        left: side + px(16),
        top: tabs + px(12),
        right: side + px(16) + px(360),
        bottom: tabs + px(12) + px(36),
      };
      fill(hdc, &search, rgb(0x1a, 0x1a, 0x1a));

      SelectObject(hdc, old);
      DeleteObject(font);
    }
  }
}

#[cfg(target_os = "windows")]
use winpaint::hide_child_windows;

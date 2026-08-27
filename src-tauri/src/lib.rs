#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      paint_title_bar(app);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// Native caption painted #000000 via DWM — Windows 11 Build 22000+; older systems ignore the attribute.
#[cfg(target_os = "windows")]
fn paint_title_bar(app: &tauri::App) {
  use tauri::Manager;

  const DWMWA_USE_IMMERSIVE_DARK_MODE: u32 = 20;
  const DWMWA_CAPTION_COLOR: u32 = 35;

  #[link(name = "dwmapi")]
  extern "system" {
    fn DwmSetWindowAttribute(hwnd: isize, attr: u32, value: *const core::ffi::c_void, size: u32) -> i32;
  }

  if let Some(win) = app.get_webview_window("main") {
    if let Ok(hwnd) = win.hwnd() {
      unsafe {
        let dark_mode: i32 = 1;
        DwmSetWindowAttribute(hwnd.0 as isize, DWMWA_USE_IMMERSIVE_DARK_MODE, (&dark_mode as *const i32).cast(), std::mem::size_of::<i32>() as u32);
        let caption: u32 = 0x000000;
        DwmSetWindowAttribute(hwnd.0 as isize, DWMWA_CAPTION_COLOR, (&caption as *const u32).cast(), std::mem::size_of::<u32>() as u32);
      }
    }
  }
}

#[cfg(not(target_os = "windows"))]
fn paint_title_bar(_app: &tauri::App) {}

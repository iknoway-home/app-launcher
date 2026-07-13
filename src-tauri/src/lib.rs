// Keep the application entry point available as a library as required by the
// Tauri build pipeline. The desktop binary remains in main.rs.
mod application {
    include!("main.rs");
}

pub use application::run;

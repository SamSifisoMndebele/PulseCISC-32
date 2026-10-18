#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cpu;
mod psi;

use cpu::{NativeCpuCore, NativeTurboResult};
use psi::{analyze_assembly_psi, PsiAnalysisReport};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

struct AppState {
    cpu: Mutex<NativeCpuCore>,
}

#[derive(Serialize)]
struct EngineInfo {
    backend: String,
    arch: String,
    os: String,
    threads: usize,
    psi_enabled: bool,
}

#[tauri::command]
fn rust_engine_info() -> EngineInfo {
    EngineInfo {
        backend: "Rust Native Core + Tauri v2".to_string(),
        arch: std::env::consts::ARCH.to_string(),
        os: std::env::consts::OS.to_string(),
        threads: std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(1),
        psi_enabled: true,
    }
}

#[tauri::command]
fn rust_analyze_psi(source: String) -> PsiAnalysisReport {
    analyze_assembly_psi(&source)
}

#[tauri::command]
fn rust_run_turbo_benchmark(
    iterations: u64,
    registers: [u32; 8],
    state: State<'_, AppState>,
) -> NativeTurboResult {
    let mut cpu = state.cpu.lock().unwrap();
    cpu.registers = registers;
    cpu.run_native_alu_benchmark(iterations.clamp(1_000, 50_000_000))
}

#[tauri::command]
fn rust_read_memory_page(offset: usize, length: usize, state: State<'_, AppState>) -> Vec<u8> {
    let cpu = state.cpu.lock().unwrap();
    cpu.read_memory_slice(offset, length)
}

#[tauri::command]
fn rust_save_asm_file(filename: String, content: String) -> Result<String, String> {
    let mut dir = std::env::current_dir().map_err(|e| e.to_string())?;
    dir.push("saved_programs");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let safe_name: String = filename
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' || c == '-' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let final_name = if safe_name.ends_with(".asm") {
        safe_name
    } else {
        format!("{}.asm", safe_name)
    };

    let mut full_path: PathBuf = dir;
    full_path.push(final_name);
    fs::write(&full_path, content).map_err(|e| e.to_string())?;
    Ok(full_path.to_string_lossy().to_string())
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            cpu: Mutex::new(NativeCpuCore::new(65536)),
        })
        .invoke_handler(tauri::generate_handler![
            rust_engine_info,
            rust_analyze_psi,
            rust_run_turbo_benchmark,
            rust_read_memory_page,
            rust_save_asm_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PulseCISC-32 Studio desktop application");
}

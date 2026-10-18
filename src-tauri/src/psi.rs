// IntelliJ-Style Program Structure Interface (PSI) & Static Analyzer for x86/MASM Assembly
use serde::Serialize;
use std::collections::HashMap;
use std::time::Instant;

#[derive(Clone, Serialize)]
pub struct PsiSymbol {
    pub name: String,
    pub kind: String, // "LABEL" | "DATA" | "CONSTANT" | "PROC"
    pub line: usize,  // 1-indexed
    pub references: usize,
    pub detail: String,
}

#[derive(Clone, Serialize)]
pub struct PsiDiagnostic {
    pub line: usize,       // 1-indexed
    pub severity: String,  // "warning" | "info" | "hint"
    pub code: String,      // e.g. "PSI-DEAD-CODE", "PSI-DIV-EDX"
    pub message: String,
}

#[derive(Clone, Serialize)]
pub struct RegisterUsage {
    pub name: String,
    pub reads: usize,
    pub writes: usize,
}

#[derive(Clone, Serialize)]
pub struct PsiAnalysisReport {
    pub symbols: Vec<PsiSymbol>,
    pub diagnostics: Vec<PsiDiagnostic>,
    pub register_usage: Vec<RegisterUsage>,
    pub instruction_count: usize,
    pub parse_time_us: u128,
}

const CANONICAL_REGS: [&str; 8] = ["EAX", "EBX", "ECX", "EDX", "ESI", "EDI", "EBP", "ESP"];

fn map_to_canonical_reg(token: &str) -> Option<&'static str> {
    match token.to_uppercase().as_str() {
        "EAX" | "AX" | "AL" | "AH" => Some("EAX"),
        "EBX" | "BX" | "BL" | "BH" => Some("EBX"),
        "ECX" | "CX" | "CL" | "CH" => Some("ECX"),
        "EDX" | "DX" | "DL" | "DH" => Some("EDX"),
        "ESI" | "SI" => Some("ESI"),
        "EDI" | "DI" => Some("EDI"),
        "EBP" | "BP" => Some("EBP"),
        "ESP" | "SP" => Some("ESP"),
        _ => None,
    }
}

pub fn analyze_assembly_psi(source: &str) -> PsiAnalysisReport {
    let start = Instant::now();

    let mut symbols: Vec<PsiSymbol> = Vec::new();
    let mut symbol_index: HashMap<String, usize> = HashMap::new();
    let mut diagnostics: Vec<PsiDiagnostic> = Vec::new();
    let mut reg_reads: HashMap<&'static str, usize> = HashMap::new();
    let mut reg_writes: HashMap<&'static str, usize> = HashMap::new();

    for r in CANONICAL_REGS {
        reg_reads.insert(r, 0);
        reg_writes.insert(r, 0);
    }

    let lines: Vec<&str> = source.lines().collect();

    // Pass 1: Collect Symbol Declarations (Labels, PROC, DB/DW/DD, EQU)
    for (idx, raw_line) in lines.iter().enumerate() {
        let line_num = idx + 1;
        let clean = raw_line.split(';').next().unwrap_or("").trim();
        if clean.is_empty() || clean.starts_with('.') {
            continue;
        }

        // Check label:
        if let Some(colon_pos) = clean.find(':') {
            let candidate = clean[..colon_pos].trim();
            if !candidate.is_empty() && !candidate.contains(' ') && !candidate.contains('[') {
                let key = candidate.to_uppercase();
                if let Some(&prev_idx) = symbol_index.get(&key) {
                    diagnostics.push(PsiDiagnostic {
                        line: line_num,
                        severity: "warning".to_string(),
                        code: "PSI-DUP-SYMBOL".to_string(),
                        message: format!(
                            "Duplicate label '{}' (previously defined on line {})",
                            candidate, symbols[prev_idx].line
                        ),
                    });
                } else {
                    symbol_index.insert(key, symbols.len());
                    symbols.push(PsiSymbol {
                        name: candidate.to_string(),
                        kind: "LABEL".to_string(),
                        line: line_num,
                        references: 0,
                        detail: "Code branch/jump target".to_string(),
                    });
                }
            }
        } else {
            // Check DATA or EQU or PROC definition: e.g. `msg DB "Hello", 0` or `MAX EQU 10`
            let parts: Vec<&str> = clean.split_whitespace().collect();
            if parts.len() >= 2 {
                let directive = parts[1].to_uppercase();
                if matches!(directive.as_str(), "DB" | "DW" | "DD" | "BYTE" | "WORD" | "DWORD") {
                    let sym_name = parts[0].trim_end_matches(':');
                    let key = sym_name.to_uppercase();
                    if !symbol_index.contains_key(&key) {
                        symbol_index.insert(key, symbols.len());
                        symbols.push(PsiSymbol {
                            name: sym_name.to_string(),
                            kind: "DATA".to_string(),
                            line: line_num,
                            references: 0,
                            detail: format!("{} data allocation", directive),
                        });
                    }
                } else if directive == "EQU" || parts[1] == "=" {
                    let sym_name = parts[0];
                    let key = sym_name.to_uppercase();
                    if !symbol_index.contains_key(&key) {
                        symbol_index.insert(key, symbols.len());
                        symbols.push(PsiSymbol {
                            name: sym_name.to_string(),
                            kind: "CONSTANT".to_string(),
                            line: line_num,
                            references: 0,
                            detail: format!("Constant ({})", parts[2..].join(" ")),
                        });
                    }
                } else if directive == "PROC" {
                    let sym_name = parts[0];
                    let key = sym_name.to_uppercase();
                    if !symbol_index.contains_key(&key) {
                        symbol_index.insert(key, symbols.len());
                        symbols.push(PsiSymbol {
                            name: sym_name.to_string(),
                            kind: "PROC".to_string(),
                            line: line_num,
                            references: 0,
                            detail: "Procedure entry point".to_string(),
                        });
                    }
                }
            }
        }
    }

    // Pass 2: Instruction AST Walk, Register Liveness, Symbol Reference Counting & Static Hazards
    let mut instruction_count = 0usize;
    let mut after_unconditional_transfer = false;
    let mut edx_prepared_for_div = false;
    let mut push_count: isize = 0;
    let mut pop_count: isize = 0;

    for (idx, raw_line) in lines.iter().enumerate() {
        let line_num = idx + 1;
        let mut clean = raw_line.split(';').next().unwrap_or("").trim();
        if clean.is_empty() || clean.starts_with('.') {
            continue;
        }

        // If line starts with a label, strip it and reset dead-code tracker
        if let Some(colon_pos) = clean.find(':') {
            let prefix = clean[..colon_pos].trim();
            if !prefix.contains(' ') && !prefix.contains('[') {
                after_unconditional_transfer = false;
                clean = clean[colon_pos + 1..].trim();
                if clean.is_empty() {
                    continue;
                }
            }
        }

        let tokens: Vec<&str> = clean.split_whitespace().collect();
        if tokens.is_empty() {
            continue;
        }

        let first_upper = tokens[0].to_uppercase();
        if tokens.len() >= 2 {
            let second_upper = tokens[1].to_uppercase();
            if matches!(
                second_upper.as_str(),
                "DB" | "DW" | "DD" | "EQU" | "=" | "PROC" | "ENDP"
            ) {
                if second_upper == "PROC" {
                    after_unconditional_transfer = false;
                }
                continue;
            }
        }
        if first_upper == "END" || first_upper == "RET" && tokens.is_empty() {
            continue;
        }

        if after_unconditional_transfer {
            diagnostics.push(PsiDiagnostic {
                line: line_num,
                severity: "warning".to_string(),
                code: "PSI-UNREACHABLE".to_string(),
                message: format!(
                    "Unreachable instruction '{}' after unconditional control transfer (missing label?)",
                    first_upper
                ),
            });
            after_unconditional_transfer = false; // only warn once per block
        }

        instruction_count += 1;

        let operand_str = if tokens.len() > 1 {
            tokens[1..].join(" ")
        } else {
            String::new()
        };

        // Count symbol references in operands
        for word in operand_str
            .split(|c: char| !c.is_alphanumeric() && c != '_')
            .filter(|s| !s.is_empty())
        {
            let key = word.to_uppercase();
            if let Some(&sym_idx) = symbol_index.get(&key) {
                symbols[sym_idx].references += 1;
            }
        }

        // Split operands by comma for register read/write analysis
        let ops: Vec<&str> = operand_str
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        // Check self-move: MOV EAX, EAX
        if first_upper == "MOV" && ops.len() == 2 && ops[0].eq_ignore_ascii_case(ops[1]) {
            diagnostics.push(PsiDiagnostic {
                line: line_num,
                severity: "info".to_string(),
                code: "PSI-REDUNDANT-MOV".to_string(),
                message: format!("Redundant self-assignment 'MOV {}, {}' has no effect", ops[0], ops[1]),
            });
        }

        // Track EDX initialization for DIV / IDIV safety inspection
        if first_upper == "CDQ"
            || first_upper == "CWD"
            || (matches!(first_upper.as_str(), "MOV" | "XOR" | "SUB")
                && ops.first().map(|o| o.eq_ignore_ascii_case("EDX") || o.eq_ignore_ascii_case("DX")).unwrap_or(false))
        {
            edx_prepared_for_div = true;
        }

        if matches!(first_upper.as_str(), "DIV" | "IDIV") {
            if !edx_prepared_for_div {
                diagnostics.push(PsiDiagnostic {
                    line: line_num,
                    severity: "warning".to_string(),
                    code: "PSI-DIV-EDX".to_string(),
                    message: format!(
                        "'{}' uses 64-bit EDX:EAX dividend, but EDX was not cleared or sign-extended (consider 'CDQ' or 'XOR EDX, EDX' before {})",
                        first_upper, first_upper
                    ),
                });
            }
            edx_prepared_for_div = false;
        }

        // Track stack balance
        if first_upper == "PUSH" {
            push_count += 1;
            *reg_reads.get_mut("ESP").unwrap() += 1;
            *reg_writes.get_mut("ESP").unwrap() += 1;
        } else if first_upper == "POP" {
            pop_count += 1;
            *reg_reads.get_mut("ESP").unwrap() += 1;
            *reg_writes.get_mut("ESP").unwrap() += 1;
        }

        // Register read/write accounting
        if let Some(first_op) = ops.first() {
            if let Some(canon) = map_to_canonical_reg(first_op) {
                if matches!(
                    first_upper.as_str(),
                    "MOV" | "MOVZX" | "MOVSX" | "LEA" | "POP"
                ) {
                    *reg_writes.get_mut(canon).unwrap() += 1;
                } else if matches!(
                    first_upper.as_str(),
                    "CMP" | "TEST" | "PUSH" | "PRINT"
                ) {
                    *reg_reads.get_mut(canon).unwrap() += 1;
                } else {
                    *reg_reads.get_mut(canon).unwrap() += 1;
                    *reg_writes.get_mut(canon).unwrap() += 1;
                }
            }
        }
        for op in ops.iter().skip(1) {
            for sub_tok in op.split(|c: char| !c.is_alphanumeric() && c != '_') {
                if let Some(canon) = map_to_canonical_reg(sub_tok) {
                    *reg_reads.get_mut(canon).unwrap() += 1;
                }
            }
        }

        // Check unconditional control transfer
        if matches!(first_upper.as_str(), "JMP" | "HLT" | "RET") {
            after_unconditional_transfer = true;
        }
    }

    // Warn on unused labels/symbols
    for sym in &symbols {
        if sym.references == 0 && sym.kind == "LABEL" && !sym.name.eq_ignore_ascii_case("main") && !sym.name.eq_ignore_ascii_case("_start") && !sym.name.eq_ignore_ascii_case("start") {
            diagnostics.push(PsiDiagnostic {
                line: sym.line,
                severity: "hint".to_string(),
                code: "PSI-UNUSED-LABEL".to_string(),
                message: format!("Label '{}' is declared but never referenced by any jump or call", sym.name),
            });
        }
    }

    if push_count != pop_count {
        diagnostics.push(PsiDiagnostic {
            line: 1,
            severity: "info".to_string(),
            code: "PSI-STACK-BALANCE".to_string(),
            message: format!(
                "Static stack balance note: {} PUSH vs {} POP instructions across source",
                push_count, pop_count
            ),
        });
    }

    let register_usage = CANONICAL_REGS
        .iter()
        .map(|&name| RegisterUsage {
            name: name.to_string(),
            reads: *reg_reads.get(name).unwrap_or(&0),
            writes: *reg_writes.get(name).unwrap_or(&0),
        })
        .collect();

    PsiAnalysisReport {
        symbols,
        diagnostics,
        register_usage,
        instruction_count,
        parse_time_us: start.elapsed().as_micros(),
    }
}

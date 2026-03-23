use std::path::Path;

pub fn shorten_path(path: &str) -> String {
    let p = Path::new(path);
    if let Some(name) = p.file_name() {
        return name.to_string_lossy().to_string();
    }
    path.to_string()
}

#[allow(dead_code)]
pub fn format_type_short(ty: &str) -> String {
    match ty {
        "string" | "String" => ":s".to_string(),
        "number" | "i32" | "i64" | "u32" | "u64" | "usize" | "f32" | "f64" => ":n".to_string(),
        "boolean" | "bool" => ":b".to_string(),
        "void" | "()" => "".to_string(),
        t if t.starts_with("Promise<") => format!("→{}", &t[8..t.len() - 1]),
        t if t.starts_with("Option<") => format!(":?{}", &t[7..t.len() - 1]),
        t if t.starts_with("Vec<") => format!(":[{}]", &t[4..t.len() - 1]),
        t if t.starts_with("Result<") => format!("→!{}", &t[7..t.len() - 1]),
        _ => format!(":{ty}"),
    }
}

pub fn format_savings(original: usize, compressed: usize) -> String {
    let saved = original.saturating_sub(compressed);
    if original == 0 {
        return "0 tok saved".to_string();
    }
    let pct = (saved as f64 / original as f64 * 100.0).round() as usize;
    format!("[{saved} tok saved ({pct}%)]")
}

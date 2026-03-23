use std::path::Path;

use crate::core::cache::SessionCache;
use crate::core::compressor;
use crate::core::entropy;
use crate::core::protocol;
use crate::core::signatures;
use crate::core::tokens::count_tokens;

pub fn handle(cache: &mut SessionCache, path: &str, mode: &str) -> String {
    let file_ref = cache.get_file_ref(path);
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    if mode == "diff" {
        return handle_diff(cache, path, &file_ref);
    }

    if let Some(existing) = cache.get(path) {
        if mode == "full" {
            let msg = format!("{file_ref} [cached {}t {}L ∅]", existing.read_count + 1, existing.line_count);
            let (_, _is_hit) = cache.store(path, existing.content.clone());
            return msg;
        }
        let content = existing.content.clone();
        let original_tokens = existing.original_tokens;
        return process_mode(&content, mode, &file_ref, ext, original_tokens);
    }

    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => return format!("ERROR: {e}"),
    };

    let (entry, _is_hit) = cache.store(path, content.clone());

    if mode == "full" {
        let tokens = entry.original_tokens;
        let output = format!("{file_ref} [{}L +]\n{content}", entry.line_count);
        let sent = count_tokens(&output);
        let savings = protocol::format_savings(tokens, sent);
        return format!("{output}\n{savings}");
    }

    process_mode(&content, mode, &file_ref, ext, entry.original_tokens)
}

fn process_mode(content: &str, mode: &str, file_ref: &str, ext: &str, original_tokens: usize) -> String {
    match mode {
        "signatures" => {
            let sigs = signatures::extract_signatures(content, ext);
            let line_count = content.lines().count();
            let mut output = format!("{file_ref} [{line_count}L +]");
            for sig in &sigs {
                output.push('\n');
                output.push_str(&sig.to_compact());
            }
            let sent = count_tokens(&output);
            let savings = protocol::format_savings(original_tokens, sent);
            format!("{output}\n{savings}")
        }
        "aggressive" => {
            let compressed = compressor::aggressive_compress(content);
            let line_count = content.lines().count();
            let sent = count_tokens(&compressed);
            let savings = protocol::format_savings(original_tokens, sent);
            format!("{file_ref} [{line_count}L +]\n{compressed}\n{savings}")
        }
        "entropy" => {
            let result = entropy::entropy_compress(content);
            let line_count = content.lines().count();
            let avg_h = entropy::analyze_entropy(content).avg_entropy;
            let mut output = format!(
                "{file_ref} [{line_count}L +] (H̄={avg_h:.1} bits/char)"
            );
            for tech in &result.techniques {
                output.push('\n');
                output.push_str(tech);
            }
            output.push('\n');
            output.push_str(&result.output);
            let sent = count_tokens(&output);
            let savings = protocol::format_savings(original_tokens, sent);
            format!("{output}\n{savings}")
        }
        _ => {
            let line_count = content.lines().count();
            format!("{file_ref} [{line_count}L +]\n{content}")
        }
    }
}

fn handle_diff(cache: &mut SessionCache, path: &str, file_ref: &str) -> String {
    let old_content = cache.get(path).map(|e| e.content.clone());

    let new_content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => return format!("ERROR: {e}"),
    };

    let original_tokens = count_tokens(&new_content);

    let diff_output = if let Some(old) = &old_content {
        compressor::diff_content(old, &new_content)
    } else {
        format!("{file_ref} [first read — no diff available]\n{new_content}")
    };

    cache.store(path, new_content);

    let sent = count_tokens(&diff_output);
    let savings = protocol::format_savings(original_tokens, sent);
    format!("{file_ref} [diff]\n{diff_output}\n{savings}")
}

use std::path::Path;

use crate::core::compressor;
use crate::core::entropy;
use crate::core::signatures;
use crate::core::tokens::count_tokens;

pub fn handle(path: &str) -> String {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => return format!("ERROR: {e}"),
    };

    let line_count = content.lines().count();
    let short = crate::core::protocol::shorten_path(path);
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    let raw_tokens = count_tokens(&content);

    let aggressive = compressor::aggressive_compress(&content);
    let aggressive_tokens = count_tokens(&aggressive);

    let sigs = signatures::extract_signatures(&content, ext);
    let sig_output: String = sigs.iter().map(|s| s.to_compact()).collect::<Vec<_>>().join("\n");
    let sig_tokens = count_tokens(&sig_output);

    let entropy_result = entropy::entropy_compress(&content);
    let entropy_tokens = entropy_result.compressed_tokens;

    let cache_hit = format!("F? [cached 2t {line_count}L ∅]");
    let cache_tokens = count_tokens(&cache_hit);

    let mut rows = Vec::new();
    rows.push(format!("Benchmark: {short} ({line_count}L)\n"));
    rows.push(format!("{:<24} {:>6}  {:>8}", "Strategy", "Tokens", "Savings"));
    rows.push("─".repeat(42));
    rows.push(format_row("raw", raw_tokens, raw_tokens));
    rows.push(format_row("aggressive", aggressive_tokens, raw_tokens));
    rows.push(format_row("signatures (compact)", sig_tokens, raw_tokens));
    rows.push(format_row("entropy", entropy_tokens, raw_tokens));
    rows.push(format_row("cache hit", cache_tokens, raw_tokens));
    rows.push("─".repeat(42));

    let strategies = [
        ("aggressive", aggressive_tokens),
        ("signatures", sig_tokens),
        ("entropy", entropy_tokens),
        ("cache hit", cache_tokens),
    ];
    let best = strategies
        .iter()
        .min_by_key(|(_, t)| *t)
        .unwrap();
    let saved = raw_tokens.saturating_sub(best.1);
    let pct = if raw_tokens > 0 {
        (saved as f64 / raw_tokens as f64 * 100.0).round() as usize
    } else {
        0
    };
    rows.push(format!(
        "Best: \"{}\" saves {} tokens ({}%)",
        best.0, saved, pct
    ));

    rows.join("\n")
}

fn format_row(name: &str, tokens: usize, baseline: usize) -> String {
    if tokens >= baseline {
        format!("{name:<24} {tokens:>6}  —")
    } else {
        let saved = baseline - tokens;
        let pct = (saved as f64 / baseline as f64 * 100.0).round() as usize;
        format!("{name:<24} {tokens:>6}  -{saved} ({pct}%)")
    }
}

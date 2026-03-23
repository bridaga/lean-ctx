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

    let short = crate::core::protocol::shorten_path(path);
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    let line_count = content.lines().count();
    let raw_tokens = count_tokens(&content);
    let analysis = entropy::analyze_entropy(&content);
    let entropy_result = entropy::entropy_compress(&content);

    let sigs = signatures::extract_signatures(&content, ext);
    let sig_output: String = sigs.iter().map(|s| s.to_compact()).collect::<Vec<_>>().join("\n");
    let sig_tokens = count_tokens(&sig_output);

    let aggressive = compressor::aggressive_compress(&content);
    let agg_tokens = count_tokens(&aggressive);

    let cache_tokens = 13usize;

    let mut sections = Vec::new();
    sections.push(format!("ANALYSIS: {short} ({line_count}L, {raw_tokens} tok)\n"));

    sections.push("Entropy Distribution:".to_string());
    sections.push(format!("  H̄ = {:.1} bits/char", analysis.avg_entropy));
    sections.push(format!(
        "  Low-entropy (H<2.0): {} lines ({:.0}%)",
        analysis.low_entropy_count,
        if analysis.total_lines > 0 {
            analysis.low_entropy_count as f64 / analysis.total_lines as f64 * 100.0
        } else {
            0.0
        }
    ));
    sections.push(format!(
        "  High-entropy (H>4.0): {} lines ({:.0}%)",
        analysis.high_entropy_count,
        if analysis.total_lines > 0 {
            analysis.high_entropy_count as f64 / analysis.total_lines as f64 * 100.0
        } else {
            0.0
        }
    ));

    sections.push(String::new());
    sections.push("Strategy Comparison:".to_string());
    sections.push(format_strategy("raw", raw_tokens, raw_tokens, false));
    sections.push(format_strategy("aggressive", agg_tokens, raw_tokens, false));
    sections.push(format_strategy("signatures", sig_tokens, raw_tokens, false));
    sections.push(format_strategy(
        "entropy",
        entropy_result.compressed_tokens,
        raw_tokens,
        false,
    ));
    sections.push(format_strategy("cache hit", cache_tokens, raw_tokens, false));

    sections.push(String::new());

    let strategies = [
        ("signatures", sig_tokens),
        ("entropy", entropy_result.compressed_tokens),
        ("aggressive", agg_tokens),
    ];
    let best = strategies.iter().min_by_key(|(_, t)| *t).unwrap();
    sections.push(format!(
        "Recommendation: {} (best first-read savings)",
        best.0
    ));

    sections.join("\n")
}

fn format_strategy(name: &str, tokens: usize, baseline: usize, recommended: bool) -> String {
    let rec = if recommended { "  ← recommended" } else { "" };
    if tokens >= baseline {
        format!("  {name:<16} {tokens:>6} tok  —{rec}")
    } else {
        let pct = ((baseline - tokens) as f64 / baseline as f64 * 100.0).round() as usize;
        format!("  {name:<16} {tokens:>6} tok  -{pct}%{rec}")
    }
}

use std::collections::HashMap;

use crate::core::cache::SessionCache;
use crate::tools::ToolCallRecord;

pub fn handle(cache: &SessionCache, tool_calls: &[ToolCallRecord]) -> String {
    let stats = cache.get_stats();
    let refs = cache.file_ref_map();

    let mut sections = Vec::new();
    sections.push("lean-ctx session".to_string());
    sections.push("═".repeat(42));

    sections.push(format!("Total reads: {}", stats.total_reads));
    sections.push(format!(
        "Cache hits: {} ({:.0}%)",
        stats.cache_hits,
        stats.hit_rate()
    ));
    sections.push(format!("Input tokens: {}", stats.total_original_tokens));
    sections.push(format!("Output tokens: {}", stats.total_sent_tokens));
    sections.push(format!(
        "Tokens saved: {} ({:.1}%)",
        stats.tokens_saved(),
        stats.savings_percent()
    ));

    sections.push("═".repeat(42));
    sections.push("By Tool:".to_string());
    sections.push("─".repeat(42));

    let mut by_tool: HashMap<String, (u32, usize, Vec<f64>)> = HashMap::new();
    for call in tool_calls {
        let entry = by_tool.entry(call.tool.clone()).or_insert((0, 0, Vec::new()));
        entry.0 += 1;
        entry.1 += call.saved_tokens;
        if call.original_tokens > 0 {
            entry.2.push(call.saved_tokens as f64 / call.original_tokens as f64 * 100.0);
        }
    }

    sections.push(format!("{:<14} {:>5}  {:>6}  {:>4}", "Tool", "Count", "Saved", "Avg%"));
    let mut sorted: Vec<_> = by_tool.iter().collect();
    sorted.sort_by(|a, b| b.1 .1.cmp(&a.1 .1));

    for (tool, (count, saved, pcts)) in &sorted {
        let avg_pct = if pcts.is_empty() {
            0.0
        } else {
            pcts.iter().sum::<f64>() / pcts.len() as f64
        };
        let saved_str = if *saved >= 1000 {
            format!("{:.1}K", *saved as f64 / 1000.0)
        } else {
            format!("{saved}")
        };
        sections.push(format!(
            "{tool:<14} {count:>5}  {saved_str:>6}  {avg_pct:>3.0}%"
        ));
    }

    if !refs.is_empty() {
        sections.push(String::new());
        sections.push("File Refs:".to_string());
        let mut ref_list: Vec<_> = refs.iter().collect();
        ref_list.sort_by_key(|(_, r)| (*r).clone());
        for (path, r) in &ref_list {
            let short = crate::core::protocol::shorten_path(path);
            sections.push(format!("  {r}={short}"));
        }
    }

    sections.join("\n")
}

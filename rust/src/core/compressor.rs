pub fn aggressive_compress(content: &str) -> String {
    let mut result = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty() {
            continue;
        }
        if trimmed.starts_with("//") && !trimmed.starts_with("///") {
            continue;
        }
        if trimmed.starts_with("/*") || trimmed.starts_with('*') || trimmed.starts_with("*/") {
            continue;
        }
        if trimmed.starts_with('#') && trimmed.contains('[') {
            continue;
        }
        if trimmed == "}" || trimmed == "};" || trimmed == ");" || trimmed == "});" {
            result.push(trimmed.to_string());
            continue;
        }

        let normalized = normalize_indentation(line);
        result.push(normalized);
    }

    result.join("\n")
}

fn normalize_indentation(line: &str) -> String {
    let leading = line.len() - line.trim_start().len();
    let reduced = leading / 2;
    format!("{}{}", " ".repeat(reduced), line.trim())
}

pub fn diff_content(old_content: &str, new_content: &str) -> String {
    let old_lines: Vec<&str> = old_content.lines().collect();
    let new_lines: Vec<&str> = new_content.lines().collect();
    let mut changes = Vec::new();
    let mut has_changes = false;

    let max_len = old_lines.len().max(new_lines.len());

    for i in 0..max_len {
        let old = old_lines.get(i).unwrap_or(&"");
        let new = new_lines.get(i).unwrap_or(&"");

        if old != new {
            has_changes = true;
            if old.is_empty() {
                changes.push(format!("+{}: {new}", i + 1));
            } else if new.is_empty() {
                changes.push(format!("-{}: {old}", i + 1));
            } else {
                changes.push(format!("~{}: {new}", i + 1));
            }
        }
    }

    if !has_changes {
        return "∅ no changes".to_string();
    }

    changes.join("\n")
}

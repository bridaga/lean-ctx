use regex::Regex;
use std::sync::OnceLock;

static ADDED_RE: OnceLock<Regex> = OnceLock::new();
static TIME_RE: OnceLock<Regex> = OnceLock::new();
static PKG_RE: OnceLock<Regex> = OnceLock::new();

fn added_re() -> &'static Regex {
    ADDED_RE.get_or_init(|| Regex::new(r"added (\d+) packages?").unwrap())
}
fn time_re() -> &'static Regex {
    TIME_RE.get_or_init(|| Regex::new(r"in (\d+\.?\d*\s*[ms]+)").unwrap())
}
fn pkg_re() -> &'static Regex {
    PKG_RE.get_or_init(|| Regex::new(r"\+ (\S+)@(\S+)").unwrap())
}

pub fn compress(command: &str, output: &str) -> Option<String> {
    if command.contains("install") || command.contains("add") {
        return Some(compress_install(output));
    }
    if command.contains("run") {
        return Some(compress_run(output));
    }
    if command.contains("test") {
        return Some(compress_test(output));
    }
    None
}

fn compress_install(output: &str) -> String {
    let mut packages = Vec::new();
    let mut dep_count = 0u32;
    let mut time = String::new();

    for line in output.lines() {
        if let Some(caps) = pkg_re().captures(line) {
            packages.push(format!("{}@{}", &caps[1], &caps[2]));
        }
        if let Some(caps) = added_re().captures(line) {
            dep_count = caps[1].parse().unwrap_or(0);
        }
        if let Some(caps) = time_re().captures(line) {
            time = caps[1].to_string();
        }
    }

    let pkg_str = if packages.is_empty() {
        String::new()
    } else {
        format!("+{}", packages.join(", +"))
    };

    let dep_str = if dep_count > 0 {
        format!(" ({dep_count} deps")
    } else {
        " (".to_string()
    };

    let time_str = if time.is_empty() {
        ")".to_string()
    } else {
        format!(", {time})")
    };

    format!("{pkg_str}{dep_str}{time_str}")
}

fn compress_run(output: &str) -> String {
    let lines: Vec<&str> = output
        .lines()
        .filter(|l| {
            let t = l.trim();
            !t.is_empty()
                && !t.starts_with('>')
                && !t.starts_with("npm warn")
                && !t.contains("npm fund")
                && !t.contains("looking for funding")
        })
        .collect();

    if lines.len() <= 5 {
        return lines.join("\n");
    }

    let last = lines.len().saturating_sub(3);
    format!(
        "...({} lines)\n{}",
        lines.len(),
        lines[last..].join("\n")
    )
}

fn compress_test(output: &str) -> String {
    let mut passed = 0u32;
    let mut failed = 0u32;
    let mut skipped = 0u32;

    for line in output.lines() {
        let trimmed = line.trim().to_lowercase();
        if trimmed.contains("pass") {
            passed += 1;
        }
        if trimmed.contains("fail") {
            failed += 1;
        }
        if trimmed.contains("skip") || trimmed.contains("pending") {
            skipped += 1;
        }
    }

    format!("tests: {passed} pass, {failed} fail, {skipped} skip")
}

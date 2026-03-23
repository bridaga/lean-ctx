pub fn compress(command: &str, output: &str) -> Option<String> {
    if command.contains("build") {
        return Some(compress_build(output));
    }
    if command.contains("ps") {
        return Some(compress_ps(output));
    }
    None
}

fn compress_build(output: &str) -> String {
    let mut steps = 0u32;
    let mut last_step = String::new();

    for line in output.lines() {
        if line.starts_with("Step ") || line.starts_with("#") && line.contains('[') {
            steps += 1;
            last_step = line.trim().to_string();
        }
    }

    if steps > 0 {
        format!("{steps} steps, last: {last_step}")
    } else {
        "built".to_string()
    }
}

fn compress_ps(output: &str) -> String {
    let lines: Vec<&str> = output.lines().collect();
    if lines.len() <= 1 {
        return "no containers".to_string();
    }

    let mut containers = Vec::new();
    for line in &lines[1..] {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 7 {
            let name = parts.last().unwrap_or(&"?");
            let status = parts.get(4).unwrap_or(&"?");
            containers.push(format!("{name}: {status}"));
        }
    }

    containers.join("\n")
}

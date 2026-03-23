use crate::core::patterns;
use crate::core::protocol;
use crate::core::tokens::count_tokens;

pub fn handle(command: &str, output: &str) -> String {
    let original_tokens = count_tokens(output);

    let compressed = match patterns::compress_output(command, output) {
        Some(c) => c,
        None => generic_compress(output),
    };

    let sent = count_tokens(&compressed);
    let savings = protocol::format_savings(original_tokens, sent);

    format!("{compressed}\n{savings}")
}

fn generic_compress(output: &str) -> String {
    let lines: Vec<&str> = output
        .lines()
        .filter(|l| {
            let t = l.trim();
            !t.is_empty()
        })
        .collect();

    if lines.len() <= 10 {
        return lines.join("\n");
    }

    let first_3 = &lines[..3];
    let last_3 = &lines[lines.len() - 3..];
    format!(
        "{}\n...({} lines omitted)\n{}",
        first_3.join("\n"),
        lines.len() - 6,
        last_3.join("\n")
    )
}

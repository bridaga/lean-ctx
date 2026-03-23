pub mod cargo;
pub mod curl;
pub mod deps_cmd;
pub mod docker;
pub mod find;
pub mod git;
pub mod grep;
pub mod ls;
pub mod npm;
pub mod test;
pub mod typescript;

pub fn compress_output(command: &str, output: &str) -> Option<String> {
    let cmd_lower = command.to_lowercase();

    if cmd_lower.starts_with("git ") {
        return git::compress(&cmd_lower, output);
    }
    if cmd_lower.starts_with("npm ") || cmd_lower.starts_with("yarn ") || cmd_lower.starts_with("pnpm ") {
        return npm::compress(&cmd_lower, output);
    }
    if cmd_lower.starts_with("cargo ") {
        return cargo::compress(&cmd_lower, output);
    }
    if cmd_lower.starts_with("docker ") {
        return docker::compress(&cmd_lower, output);
    }
    if cmd_lower.starts_with("tsc") || cmd_lower.contains("typescript") {
        return typescript::compress(output);
    }
    if cmd_lower.starts_with("grep ") || cmd_lower.starts_with("rg ") {
        return grep::compress(output);
    }
    if cmd_lower.starts_with("find ") {
        return find::compress(output);
    }
    if cmd_lower.starts_with("ls ") || cmd_lower == "ls" {
        return ls::compress(output);
    }
    if cmd_lower.starts_with("curl ") {
        return curl::compress(output);
    }

    if let Some(r) = test::compress(output) {
        return Some(r);
    }

    None
}

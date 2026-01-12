use wasm_bindgen::prelude::*;
use similar::{TextDiff, ChangeTag};
#[wasm_bindgen]
pub struct DiffCounts {
    pub added: usize,
    pub removed: usize,
}
#[wasm_bindgen]
pub fn count_diff(from: &str, to: &str) -> DiffCounts {
    let from_lines: Vec<&str> = from.split('\n').collect();
    let to_lines: Vec<&str> = to.split('\n').collect();
    let diff = TextDiff::from_slices(&from_lines, &to_lines);
    let mut added = 0;
    let mut removed = 0;
    for change in diff.iter_all_changes() {
        match change.tag() {
            ChangeTag::Delete => removed += 1,
            ChangeTag::Insert => added += 1,
            _ => {}
        }
    }
    DiffCounts { added, removed }
}
#[wasm_bindgen]
pub fn get_diff_content(filename: &str, from_content: &str, to_content: &str) -> String {
    let from_lines: Vec<&str> = from_content.split('\n').collect();
    let to_lines: Vec<&str> = to_content.split('\n').collect();
    let diff = TextDiff::from_slices(&from_lines, &to_lines);
    let mut result = format!("--- from/{}\n+++ to/{}", filename, filename);
    for change in diff.iter_all_changes() {
        let sign = match change.tag() {
            ChangeTag::Delete => "-",
            ChangeTag::Insert => "+",
            ChangeTag::Equal => " ",
        };
        result.push('\n');
        result.push_str(sign);
        result.push(' ');
        result.push_str(change.value());
    }
    result
}
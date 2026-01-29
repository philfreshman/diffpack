use std::collections::HashMap;
use std::fs::File;
use std::hint::black_box;
use std::io::{self, Read};
use std::path::{Component, Path, PathBuf};

use criterion::{criterion_group, criterion_main, Criterion};
use flate2::read::GzDecoder;
use tar::Archive;

#[allow(dead_code)]
#[path = "../src/core.rs"]
mod core;
#[path = "../src/types.rs"]
mod types;
use types::{FileMapEntry, FileType};

fn normalize_entry_path(path: PathBuf) -> Option<String> {
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return None;
    }

    let path_str = path.to_string_lossy().to_string();
    if path_str.is_empty() {
        None
    } else {
        Some(path_str)
    }
}

fn load_tgz_file_map(path: &Path) -> io::Result<HashMap<String, FileMapEntry>> {
    let file = File::open(path)?;
    let decoder = GzDecoder::new(file);
    let mut archive = Archive::new(decoder);
    let mut map = HashMap::new();

    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = match normalize_entry_path(entry.path()?.to_path_buf()) {
            Some(path) => path,
            None => continue,
        };
        let entry_type = entry.header().entry_type();

        if entry_type.is_dir() {
            map.insert(
                path,
                FileMapEntry {
                    file_type: FileType::Directory,
                    content: String::new(),
                },
            );
            continue;
        }

        if !entry_type.is_file() {
            continue;
        }

        let mut buffer = Vec::new();
        entry.read_to_end(&mut buffer)?;
        let content = String::from_utf8_lossy(&buffer).into_owned();

        map.insert(
            path,
            FileMapEntry {
                file_type: FileType::File,
                content,
            },
        );
    }

    Ok(map)
}

fn bench_build_diff_tree(c: &mut Criterion) {
    let benches_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("benches");
    let from_path = benches_dir.join("react-query-3.34.14.tgz");
    let to_path = benches_dir.join("react-query-4.0.0.tgz");

    let from_files =
        load_tgz_file_map(&from_path).expect("failed to load react-query-3.34.14.tgz");
    let to_files = load_tgz_file_map(&to_path).expect("failed to load react-query-4.0.0.tgz");

    c.bench_function("build_diff_tree/react_query", |b| {
        b.iter(|| {
            let tree = core::build_diff_tree(
                black_box(from_files.clone()),
                black_box(to_files.clone()),
                0.7,
            );
            black_box(tree);
        })
    });
}

criterion_group! {
    name = tree_benches;
    config = Criterion::default().sample_size(30);
    targets = bench_build_diff_tree
}
criterion_main!(tree_benches);

use std::collections::HashMap;
use std::hint::black_box;

use criterion::{criterion_group, criterion_main, Criterion};

#[allow(dead_code)]
#[path = "../src/core.rs"]
mod core;
#[path = "../src/types.rs"]
mod types;
use types::{FileMapEntry, FileType};

fn make_content(file_index: usize) -> String {
    let mut content = String::with_capacity(128);
    for line in 0..6 {
        content.push_str(&format!("file-{file_index} line-{line}\n"));
    }
    content
}

fn make_file_maps(
    file_count: usize,
    dir_count: usize,
    change_stride: usize,
    rename_stride: usize,
    remove_stride: usize,
    added_files: usize,
) -> (HashMap<String, FileMapEntry>, HashMap<String, FileMapEntry>) {
    let mut from_map = HashMap::with_capacity(file_count);
    let mut to_map = HashMap::with_capacity(file_count + added_files);

    for i in 0..file_count {
        let dir = i % dir_count;
        let path = format!("dir{dir}/file_{i}.txt");
        let content = make_content(i);

        from_map.insert(
            path.clone(),
            FileMapEntry {
                file_type: FileType::File,
                content: content.clone(),
            },
        );

        if i % rename_stride == 0 {
            let new_path = format!("dir{dir}/renamed_{i}.txt");
            to_map.insert(
                new_path,
                FileMapEntry {
                    file_type: FileType::File,
                    content,
                },
            );
            continue;
        }

        if i % remove_stride == 0 {
            continue;
        }

        let mut to_content = content;
        if i % change_stride == 0 {
            to_content.push_str("extra-change\n");
        }

        to_map.insert(
            path,
            FileMapEntry {
                file_type: FileType::File,
                content: to_content,
            },
        );
    }

    for i in 0..added_files {
        let path = format!("added/added_{i}.txt");
        let content = format!("added file {i}\n");
        to_map.insert(
            path,
            FileMapEntry {
                file_type: FileType::File,
                content,
            },
        );
    }

    (from_map, to_map)
}

fn bench_build_diff_tree(c: &mut Criterion) {
    let (from_files, to_files) = make_file_maps(1_000, 25, 9, 23, 17, 120);

    c.bench_function("build_diff_tree/1k_files", |b| {
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

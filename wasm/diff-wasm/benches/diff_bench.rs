use std::hint::black_box;
use criterion::{criterion_group, criterion_main, Criterion};
use diff_wasm::{count_diff, get_diff_content};

fn make_contents(line_count: usize, change_stride: usize) -> (String, String) {
    let mut from = String::with_capacity(line_count * 20);
    let mut to = String::with_capacity(line_count * 20);

    for i in 0..line_count {
        let line = format!("line-{i} value={}", i % 10);
        from.push_str(&line);
        from.push('\n');

        if i % change_stride == 0 {
            let changed = format!("line-{i} value=changed");
            to.push_str(&changed);
        } else {
            to.push_str(&line);
        }
        to.push('\n');
    }

    (from, to)
}

fn bench_count_diff(c: &mut Criterion) {
    let (from, to) = make_contents(2_000, 10);

    c.bench_function("count_diff/2k_lines", |b| {
        b.iter(|| {
            let counts = count_diff(black_box(&from), black_box(&to));
            black_box(counts);
        })
    });
}

fn bench_get_diff_content(c: &mut Criterion) {
    let (from, to) = make_contents(2_000, 10);
    let filename = "fixture.txt";

    c.bench_function("get_diff_content/2k_lines", |b| {
        b.iter(|| {
            let diff = get_diff_content(black_box(filename), black_box(&from), black_box(&to));
            black_box(diff);
        })
    });
}

criterion_group! {
    name = diff_benches;
    config = Criterion::default().sample_size(50);
    targets = bench_count_diff, bench_get_diff_content
}
criterion_main!(diff_benches);

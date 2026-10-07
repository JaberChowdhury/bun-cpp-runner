import { Language, SnippetType } from '../types';

export const SNIPPETS: Record<Language, Record<SnippetType, string>> = {
  cpp: {
    blank: `#include <iostream>

int main() {
    
    return 0;
}`,
    basic: `#include <iostream>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    int t;
    if (cin >> t) {
        while (t--) {
            int a, b;
            if (cin >> a >> b) {
                cout << (a + b) << "\\n";
            }
        }
    }
    return 0;
}`,
    graph: `#include <iostream>
#include <vector>
using namespace std;

const int MAXN = 1e5 + 5;
vector<int> adj[MAXN];
bool visited[MAXN];

void dfs(int v) {
    visited[v] = true;
    for (int u : adj[v]) {
        if (!visited[u]) dfs(u);
    }
}

int main() {
    int n, m;
    if (cin >> n >> m) {
        for (int i = 0; i < m; i++) {
            int u, v;
            cin >> u >> v;
            adj[u].push_back(v);
            adj[v].push_back(u);
        }
        cout << "Graph built with " << n << " nodes and " << m << " edges." << "\\n";
    }
    return 0;
}`,
  },
  rust: {
    blank: `fn main() {
    
}`,
    basic: `use std::io::{self, BufRead};

fn main() {
    let stdin = io::stdin();
    let mut lines = stdin.lock().lines();

    if let Some(Ok(first_line)) = lines.next() {
        if let Ok(t) = first_line.trim().parse::<usize>() {
            for _ in 0..t {
                if let Some(Ok(line)) = lines.next() {
                    let nums: Vec<i64> = line
                        .split_whitespace()
                        .filter_map(|s| s.parse().ok())
                        .collect();
                    if nums.len() >= 2 {
                        println!("{}", nums[0] + nums[1]);
                    }
                }
            }
        }
    }
}`,
    graph: `use std::collections::{HashMap, HashSet};

fn dfs(v: i32, adj: &HashMap<i32, Vec<i32>>, visited: &mut HashSet<i32>) {
    visited.insert(v);
    if let Some(neighbors) = adj.get(&v) {
        for &u in neighbors {
            if !visited.contains(&u) {
                dfs(u, adj, visited);
            }
        }
    }
}

fn main() {
    let mut adj: HashMap<i32, Vec<i32>> = HashMap::new();
    adj.entry(1).or_default().push(2);
    adj.entry(2).or_default().push(3);

    let mut visited = HashSet::new();
    dfs(1, &adj, &mut visited);
    println!("Visited nodes: {:?}", visited);
}`,
  },
};

export const COMPILER_FLAGS_OPTIONS: Record<Language, { label: string; value: string; description: string }[]> = {
  cpp: [
    { label: '-O3', value: '-O3', description: 'Enable aggressive optimizations' },
    { label: '-Wall', value: '-Wall', description: 'Enable all standard compiler warnings' },
    { label: '-std=c++20', value: '-std=c++20', description: 'ISO C++20 standard support' },
    { label: '-Wextra', value: '-Wextra', description: 'Enable additional compiler warnings' },
  ],
  rust: [
    { label: '-O', value: '-O', description: 'Equivalent to opt-level=2 optimization' },
    { label: '-C opt-level=3', value: '-C opt-level=3', description: 'Maximum release optimization' },
  ],
};

export const DEFAULT_INPUT = `3
1 2
10 20
-5 5`;

export const DEFAULT_EXPECTED_OUTPUT = `3
30
0`;

//! Geval CLI - deterministic decision engine for AI system changes.

use anyhow::Result;
use clap::Parser;
use geval::cli::Commands;

fn main() -> Result<()> {
    let cli = Commands::parse();
    cli.run()
}

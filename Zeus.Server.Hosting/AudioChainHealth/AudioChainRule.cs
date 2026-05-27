// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.

using Zeus.Contracts;

namespace Zeus.Server.AudioChainHealth;

/// <summary>
/// Direction a level rule trips in. <c>Above</c> = the rule warns
/// when the reading rises past the threshold (e.g. ALC clipping at
/// +0 dBFS, SWR &gt; 2.0). <c>Below</c> = the rule warns when the
/// reading falls past the threshold (e.g. Mic level &lt; -40 dBFS).
/// </summary>
public enum TripDirection
{
    Above,
    Below,
}

/// <summary>
/// What the apply endpoint will do when the operator clicks Apply on
/// this verdict. <see cref="Kind"/> is a stable string discriminator
/// the dispatcher pattern-matches on (e.g. <c>"tx.mic-gain-db"</c>,
/// <c>"tx.leveler-max-gain-db"</c>, <c>"tx.drive-pct"</c>); the
/// dispatcher maps each to an existing backend setter — see zeus-pgn.
/// <see cref="Value"/> is the absolute target value (never a delta)
/// per ADR-0003.
/// </summary>
public readonly record struct AudioChainApplyAction(string Kind, double Value);

/// <summary>
/// A single declarative rule the evaluator runs. Data-driven by
/// design so the base rule set (zeus-1x4) is a static list of
/// <c>AudioChainRule</c> records and per-context overrides (zeus-y89)
/// produce different rules off the same shape rather than subclassing.
///
/// <para><b>Hysteresis:</b> the rule trips when the reading crosses
/// <see cref="EnterThreshold"/> in the <see cref="Direction"/> sense,
/// and clears when the reading crosses <see cref="ExitThreshold"/> in
/// the opposite sense. For an "above" rule, <c>ExitThreshold</c> must
/// be &lt; <c>EnterThreshold</c> by the hysteresis band; for a "below"
/// rule, <c>ExitThreshold</c> must be &gt; <c>EnterThreshold</c>.</para>
///
/// <para><b>Sustained-violation:</b> the rule must remain raw-tripping
/// (post-hysteresis) for at least the window — default 3 s for
/// <see cref="AudioChainSeverity.Warn"/>, 5 s for
/// <see cref="AudioChainSeverity.Error"/>, override via
/// <see cref="SustainedWindow"/>. The evaluator handles the timing;
/// rules just declare the latching thresholds.</para>
/// </summary>
public sealed record AudioChainRule
{
    /// <summary>Stable identifier — used as the per-rule state key in
    /// the evaluator. Two rules with the same name will share state, so
    /// keep names unique across the rule set.</summary>
    public required string Name { get; init; }

    public required AudioChainStageId Stage { get; init; }

    public required AudioChainSeverity Severity { get; init; }

    /// <summary>True for "stop tx now" rules (e.g. SWR &gt; 3:1). Only
    /// meaningful when <see cref="Severity"/> = Error.</summary>
    public bool ImmediateAction { get; init; }

    /// <summary>Applicability filter. The evaluator skips the rule entirely
    /// (and clears its latched state) when this returns false. Mode/board
    /// awareness lives here.</summary>
    public required Func<RuleContext, bool> AppliesIn { get; init; }

    /// <summary>Reads the value the threshold check fires off.</summary>
    public required Func<AudioChainReadings, float> Read { get; init; }

    public required double EnterThreshold { get; init; }
    public required double ExitThreshold { get; init; }
    public TripDirection Direction { get; init; } = TripDirection.Above;

    /// <summary>Renders the one-line human message when the verdict fires.
    /// Called only on the firing tick; not in the hot path.</summary>
    public required Func<AudioChainReadings, RuleContext, string> Message { get; init; }

    /// <summary>Renders the Apply-button label (e.g.
    /// <c>"Apply · 22 → 28 dB"</c>). Empty / null if the rule has no
    /// apply action.</summary>
    public Func<AudioChainReadings, RuleContext, string>? ApplyLabel { get; init; }

    /// <summary>Computes the absolute apply target. Null if the rule has
    /// no apply action.</summary>
    public Func<AudioChainReadings, RuleContext, AudioChainApplyAction?>? Apply { get; init; }

    /// <summary>Override the default sustained-violation window for this
    /// rule. Null = default (3 s warn / 5 s error).</summary>
    public TimeSpan? SustainedWindow { get; init; }
}

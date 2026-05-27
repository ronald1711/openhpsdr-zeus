// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.

using Zeus.Contracts;

namespace Zeus.Server.AudioChainHealth;

/// <summary>
/// Per-(mode, board) overrides on top of <see cref="BaseRules"/>. The
/// base set is written for SSB on a generic ANAN-class board; the
/// overrides express the canonical chain personality for every other
/// context Zeus supports:
///
/// <list type="bullet">
/// <item><b>CW</b> — WDSP TXA is bypassed; only Wire / PA stages
/// remain meaningful. Each WDSP tile emits an Info verdict so the
/// widget renders the muted "stage idle by design" state instead of
/// a misleading all-OK.</item>
/// <item><b>FM</b> — Leveler / CFC / Compressor are bypassed by the
/// FM modulator path. Same Info-pill treatment.</item>
/// <item><b>Digital (DIGU / DIGL)</b> — operator wants a flat chain.
/// Any active processing (Leveler / CFC / Comp / ALC GR) is a defect
/// — we INVERT the verdict so "leveler doing work" warns in digital
/// where it'd be OK in SSB.</item>
/// <item><b>AM</b> — ALC headroom shifts (carrier eats 6 dB), so the
/// "ALC working hard" threshold is more permissive. Mic / EQ /
/// Leveler / CFC / Comp / Out / Wire / PA all behave per the base
/// set.</item>
/// <item><b>HL2 board</b> — drive ceiling is meaningful much earlier
/// than on the 8-bit-drive ANAN family, because the 4-bit register
/// crowds at ~80% requested drive. Tighter warn threshold replaces
/// the generic ceiling.</item>
/// </list>
///
/// Overrides are layered as additional rules with their own
/// <c>AppliesIn</c> predicates — they don't mutate the base set.
/// Worst-severity-per-stage selection in <c>AudioChainHealthService</c>
/// picks the right verdict per tile when multiple rules fire on the
/// same stage simultaneously.
/// </summary>
public static class PerContextOverrides
{
    public static IReadOnlyList<AudioChainRule> All { get; } = BuildAll();

    private static List<AudioChainRule> BuildAll()
    {
        var rules = new List<AudioChainRule>();

        // ---------------- CW ----------------
        // WDSP TXA is bypassed in CW modes — Mic through Out tiles
        // are idle-by-design. Emit Info verdicts so the widget mutes
        // those tiles. Wire / PA tiles continue to use the base
        // ruleset (MOX-only gates already allow them in CW).
        rules.Add(InfoOnAppliesIn(
            name: "cw.wdsp.bypass.mic",
            stage: AudioChainStageId.Mic,
            message: "Mic / TXA chain bypassed in CW.",
            applies: c => IsCw(c) && c.Mox));
        rules.Add(InfoOnAppliesIn(
            name: "cw.wdsp.bypass.eq",
            stage: AudioChainStageId.Eq,
            message: "EQ bypassed in CW.",
            applies: c => IsCw(c) && c.Mox));
        rules.Add(InfoOnAppliesIn(
            name: "cw.wdsp.bypass.leveler",
            stage: AudioChainStageId.Leveler,
            message: "Leveler bypassed in CW.",
            applies: c => IsCw(c) && c.Mox));
        rules.Add(InfoOnAppliesIn(
            name: "cw.wdsp.bypass.cfc",
            stage: AudioChainStageId.Cfc,
            message: "CFC bypassed in CW.",
            applies: c => IsCw(c) && c.Mox));
        rules.Add(InfoOnAppliesIn(
            name: "cw.wdsp.bypass.comp",
            stage: AudioChainStageId.Comp,
            message: "Compressor bypassed in CW.",
            applies: c => IsCw(c) && c.Mox));
        rules.Add(InfoOnAppliesIn(
            name: "cw.wdsp.bypass.alc",
            stage: AudioChainStageId.Alc,
            message: "ALC not used in CW (envelope is the keyer's job).",
            applies: c => IsCw(c) && c.Mox));
        rules.Add(InfoOnAppliesIn(
            name: "cw.wdsp.bypass.out",
            stage: AudioChainStageId.Out,
            message: "TXA output bypassed in CW.",
            applies: c => IsCw(c) && c.Mox));

        // ---------------- FM ----------------
        // FM modulator path skips dynamics — Leveler / CFC / Comp
        // would just add unwanted modulation if active. Mic / EQ
        // still meaningful (pre-emphasis lives in EQ). ALC / Out
        // also meaningful (the FM modulator still has a level).
        rules.Add(InfoOnAppliesIn(
            name: "fm.bypass.leveler",
            stage: AudioChainStageId.Leveler,
            message: "Leveler bypassed in FM (dynamics inside FM modulator).",
            applies: c => c.Mode == RxMode.FM && c.Mox));
        rules.Add(InfoOnAppliesIn(
            name: "fm.bypass.cfc",
            stage: AudioChainStageId.Cfc,
            message: "CFC bypassed in FM.",
            applies: c => c.Mode == RxMode.FM && c.Mox));
        rules.Add(InfoOnAppliesIn(
            name: "fm.bypass.comp",
            stage: AudioChainStageId.Comp,
            message: "Compressor bypassed in FM.",
            applies: c => c.Mode == RxMode.FM && c.Mox));

        // ---------------- Digital (DIGU / DIGL) ----------------
        // Digital protocols want a flat chain — any leveler / CFC /
        // compressor activity is a defect (squashes the dynamic range
        // the protocol needs). Warn the operator that processing
        // they'd want in SSB is on in digital. Stage-tile verdict
        // worst-severity selection lets these coexist with the base
        // rules (which wouldn't fire in digital anyway — they're
        // SSB-gated).
        rules.Add(new AudioChainRule
        {
            Name = "digital.leveler.active",
            Stage = AudioChainStageId.Leveler,
            Severity = AudioChainSeverity.Warn,
            AppliesIn = c => IsDigital(c) && c.Mox,
            Read = r => BaseRules_SafeGr(r.LvlrGr),
            EnterThreshold = 1,
            ExitThreshold = 0.5,
            Direction = TripDirection.Above,
            Message = (r, _) => FormattableString.Invariant(
                $"Leveler engaged ({r.LvlrGr:F0} dB GR) — digital wants a flat chain."),
            ApplyLabel = (_, _) => "Apply · disable Leveler",
            Apply = (_, _) => new AudioChainApplyAction("tx.leveler-max-gain-db", 0),
        });
        rules.Add(new AudioChainRule
        {
            Name = "digital.cfc.active",
            Stage = AudioChainStageId.Cfc,
            Severity = AudioChainSeverity.Warn,
            AppliesIn = c => IsDigital(c) && c.Mox,
            Read = r => BaseRules_SafeGr(r.CfcGr),
            EnterThreshold = 1,
            ExitThreshold = 0.5,
            Direction = TripDirection.Above,
            Message = (r, _) => FormattableString.Invariant(
                $"CFC engaged ({r.CfcGr:F0} dB GR) — digital wants a flat chain."),
        });
        rules.Add(new AudioChainRule
        {
            Name = "digital.comp.active",
            Stage = AudioChainStageId.Comp,
            Severity = AudioChainSeverity.Warn,
            AppliesIn = c => IsDigital(c) && c.Mox,
            // Compressor "active" = output peak near 0 dBFS — without a
            // direct comp-GR we use the same proxy the base set uses.
            Read = r => BaseRules_SafeForAbove(r.CompPk),
            EnterThreshold = -10,
            ExitThreshold = -12,
            Direction = TripDirection.Above,
            Message = (r, _) => FormattableString.Invariant(
                $"Compressor engaged ({r.CompPk:F0} dBFS) — digital wants a flat chain."),
        });

        // ---------------- AM ----------------
        // AM's carrier eats ~6 dB of available envelope, so the ALC
        // GR threshold from the base set (6 dB) is too tight — normal
        // AM operation routinely shows 4-6 dB ALC GR. Replace with a
        // higher trigger.
        rules.Add(new AudioChainRule
        {
            Name = "am.alc.excessive",
            Stage = AudioChainStageId.Alc,
            Severity = AudioChainSeverity.Warn,
            AppliesIn = c => c.Mode == RxMode.AM && c.Mox,
            Read = r => BaseRules_SafeGr(r.AlcGr),
            EnterThreshold = 10,
            ExitThreshold = 8,
            Direction = TripDirection.Above,
            Message = (r, _) => FormattableString.Invariant(
                $"ALC working hard for AM — gain reduction {r.AlcGr:F0} dB. Lower drive."),
        });

        // ---------------- HL2 board ----------------
        // HL2's drive byte is a 4-bit register — the granularity is
        // coarse (16 steps over 0-100% requested) and the curve
        // crowds at the top end. By the time the operator's slider
        // reads 80%, the register is at its peak step on most bands.
        // Tighter ceiling rule fires earlier so the operator knows
        // their "raise drive" gesture isn't going to help.
        rules.Add(new AudioChainRule
        {
            Name = "hl2.wire.drive.ceiling",
            Stage = AudioChainStageId.Wire,
            Severity = AudioChainSeverity.Warn,
            AppliesIn = c => c.Board == HpsdrBoardKind.HermesLite2 && c.Mox,
            Read = r => r.DrivePct,
            EnterThreshold = 80,
            ExitThreshold = 75,
            Direction = TripDirection.Above,
            Message = (r, _) => FormattableString.Invariant(
                $"Drive at HL2 ceiling ({r.DrivePct}%) — 4-bit register near max, further raise won't add output."),
        });

        return rules;
    }

    // ---------------- helpers ----------------

    private static bool IsCw(RuleContext c) => c.Mode == RxMode.CWL || c.Mode == RxMode.CWU;
    private static bool IsDigital(RuleContext c) => c.Mode == RxMode.DIGL || c.Mode == RxMode.DIGU;

    /// <summary>
    /// Produces an Info-severity rule that fires (sustained-window
    /// 0 s, so immediately) whenever its <paramref name="applies"/>
    /// predicate is true. Used for "stage idle by design" tiles in
    /// modes where a stage is bypassed — the widget renders these
    /// muted via the Info pill, instead of a misleading green OK.
    /// </summary>
    private static AudioChainRule InfoOnAppliesIn(
        string name,
        AudioChainStageId stage,
        string message,
        Func<RuleContext, bool> applies) => new()
    {
        Name = name,
        Stage = stage,
        Severity = AudioChainSeverity.Info,
        AppliesIn = applies,
        // Read returns a constant that ALWAYS crosses the threshold
        // — combined with AppliesIn, the rule is "fired" the moment
        // the context matches. Zero sustained window so the operator
        // sees the muted tile immediately on mode switch.
        Read = _ => 1,
        EnterThreshold = 0,
        ExitThreshold = -1,
        Direction = TripDirection.Above,
        Message = (_, _) => message,
        SustainedWindow = TimeSpan.Zero,
    };

    // Re-export of BaseRules.Safe* helpers — same idea, kept private to
    // each file to avoid making BaseRules a public utility surface.
    private static float BaseRules_SafeGr(float gr) =>
        !float.IsFinite(gr) ? 0f : gr;

    private static float BaseRules_SafeForAbove(float dbfs) =>
        AudioChainReadings.IsSentinel(dbfs) ? -100f : dbfs;
}

/// <summary>
/// Composite rule provider — concatenates the base rule set with the
/// per-context override list. The evaluator handles the rest (each
/// rule's AppliesIn gate selects in/out per tick; service-level
/// worst-severity-per-stage picks the winner when multiple rules
/// fire on the same tile).
/// </summary>
public sealed class BaseAndContextOverrideRuleProvider : IAudioChainRuleProvider
{
    public IReadOnlyList<AudioChainRule> Rules { get; } =
        BaseRules.All.Concat(PerContextOverrides.All).ToArray();
}

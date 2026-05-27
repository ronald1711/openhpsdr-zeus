// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.

using Zeus.Contracts;
using Zeus.Dsp;

namespace Zeus.Server.AudioChainHealth;

/// <summary>
/// Everything a rule can read about the current audio chain — one
/// snapshot per <see cref="AudioChainHealthService"/> tick. Rules MUST
/// be pure functions of this struct + <see cref="RuleContext"/>; they
/// must not capture state or read from services directly, so the
/// service can mock the readings cleanly in tests.
///
/// Field semantics mirror <see cref="TxStageMeters"/>: level fields
/// (*Pk/*Av) are dBFS where <c>≤ -200</c> means "stage idle / WDSP
/// silence sentinel", gain-reduction fields (*Gr) are positive dB of
/// cut (0 = no reduction).
/// </summary>
public readonly record struct AudioChainReadings(
    float MicPk,
    float MicAv,
    float EqPk,
    float EqAv,
    float LvlrPk,
    float LvlrAv,
    float LvlrGr,
    float CfcPk,
    float CfcAv,
    float CfcGr,
    float CompPk,
    float CompAv,
    float AlcPk,
    float AlcAv,
    float AlcGr,
    float OutPk,
    float OutAv,
    int DrivePct,
    int DriveByte,
    float FwdWatts,
    float RefWatts,
    float Swr,
    // Current parameter values — surfaced so rules can compute
    // absolute apply targets (per ADR-0003). The Apply payload is
    // an absolute setter value, not a delta; rules need to know the
    // current value to compute the absolute target. Source: the
    // service reads these from RadioService.Snapshot() each tick.
    int MicGainDb,
    double LevelerMaxGainDb,
    double CfcPreCompDb)
{
    /// <summary>
    /// "Stage is bypassed / sentinel" predicate. WDSP returns ≤ -200 dBFS
    /// (typically near the -400 silence sentinel) for stages that aren't
    /// processing. Rules use this to suppress level-too-low warnings on
    /// stages that legitimately aren't running.
    /// </summary>
    public static bool IsSentinel(float dbfs) =>
        !float.IsFinite(dbfs) || dbfs <= -200f;

    public static AudioChainReadings FromTxStageMeters(
        in TxStageMeters s,
        int drivePct,
        int driveByte,
        float fwdWatts,
        float refWatts,
        float swr,
        int micGainDb,
        double levelerMaxGainDb,
        double cfcPreCompDb) =>
        new(
            MicPk: s.MicPk, MicAv: s.MicAv,
            EqPk: s.EqPk, EqAv: s.EqAv,
            LvlrPk: s.LvlrPk, LvlrAv: s.LvlrAv, LvlrGr: s.LvlrGr,
            CfcPk: s.CfcPk, CfcAv: s.CfcAv, CfcGr: s.CfcGr,
            CompPk: s.CompPk, CompAv: s.CompAv,
            AlcPk: s.AlcPk, AlcAv: s.AlcAv, AlcGr: s.AlcGr,
            OutPk: s.OutPk, OutAv: s.OutAv,
            DrivePct: drivePct, DriveByte: driveByte,
            FwdWatts: fwdWatts, RefWatts: refWatts, Swr: swr,
            MicGainDb: micGainDb,
            LevelerMaxGainDb: levelerMaxGainDb,
            CfcPreCompDb: cfcPreCompDb);
}

/// <summary>
/// Context surrounding the readings. The rule selector + per-rule
/// <c>AppliesIn</c> predicate fire off this struct. Per ADR-0001 the
/// rule engine is the only place that branches on mode/board — the
/// concrete rules live in the base rule set and per-context overrides
/// (zeus-1x4, zeus-y89).
/// </summary>
public readonly record struct RuleContext(
    RxMode Mode,
    HpsdrBoardKind Board,
    bool Mox);

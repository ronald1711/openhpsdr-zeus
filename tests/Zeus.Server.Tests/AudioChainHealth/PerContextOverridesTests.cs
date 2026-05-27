// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.

using Zeus.Contracts;
using Zeus.Server.AudioChainHealth;
using Xunit;

namespace Zeus.Server.Tests.AudioChainHealth;

public class PerContextOverridesTests
{
    private static readonly DateTime T0 = new(2026, 5, 27, 12, 0, 0, DateTimeKind.Utc);

    private static AudioChainReadings AllQuiet => new(
        MicPk: -12, MicAv: -24,
        EqPk: -10, EqAv: -22,
        LvlrPk: -10, LvlrAv: -20, LvlrGr: 0,
        CfcPk: -10, CfcAv: -18, CfcGr: 0,
        CompPk: -50, CompAv: -50,
        AlcPk: -6, AlcAv: -6, AlcGr: 0,
        OutPk: -3, OutAv: -3,
        DrivePct: 60, DriveByte: 0,
        FwdWatts: 80, RefWatts: 2, Swr: 1.2f,
        MicGainDb: 4, LevelerMaxGainDb: 8, CfcPreCompDb: 0);

    private static IReadOnlyList<AudioChainRule> Composite =>
        new BaseAndContextOverrideRuleProvider().Rules;

    [Fact]
    public void CwMode_FiresInfoOnEveryWdspStage()
    {
        var ev = new RuleEvaluator();
        var cw = new RuleContext(RxMode.CWU, HpsdrBoardKind.HermesLite2, Mox: true);

        // CW info rules use SustainedWindow=Zero — they fire on the
        // first tick.
        var fired = ev.Evaluate(Composite, AllQuiet, cw, T0);

        // 7 WDSP stages should each have an Info verdict.
        var wdspStages = new[]
        {
            AudioChainStageId.Mic,
            AudioChainStageId.Eq,
            AudioChainStageId.Leveler,
            AudioChainStageId.Cfc,
            AudioChainStageId.Comp,
            AudioChainStageId.Alc,
            AudioChainStageId.Out,
        };
        foreach (var s in wdspStages)
        {
            var rule = fired.FirstOrDefault(f =>
                f.Rule.Stage == s && f.Rule.Severity == AudioChainSeverity.Info);
            Assert.True(rule.Rule is not null, $"expected info rule on stage {s}");
        }
    }

    [Fact]
    public void FmMode_FiresInfoOnLevelerCfcComp_Only()
    {
        var ev = new RuleEvaluator();
        var fm = new RuleContext(RxMode.FM, HpsdrBoardKind.HermesLite2, Mox: true);

        var fired = ev.Evaluate(Composite, AllQuiet, fm, T0);

        // FM bypasses Leveler / CFC / Comp specifically.
        Assert.Contains(fired, f => f.Rule.Name == "fm.bypass.leveler");
        Assert.Contains(fired, f => f.Rule.Name == "fm.bypass.cfc");
        Assert.Contains(fired, f => f.Rule.Name == "fm.bypass.comp");
        // Mic / EQ / ALC / Out NOT bypassed — no FM info rule for them.
        Assert.DoesNotContain(fired, f => f.Rule.Name.StartsWith("fm.bypass.mic"));
        Assert.DoesNotContain(fired, f => f.Rule.Name.StartsWith("fm.bypass.eq"));
    }

    [Fact]
    public void DigitalMode_WarnsOnLevelerActive()
    {
        var ev = new RuleEvaluator();
        var digu = new RuleContext(RxMode.DIGU, HpsdrBoardKind.HermesLite2, Mox: true);

        // Operator running digital with leveler still on — GR > 1 dB
        // should warn (inverted compared to SSB).
        var levelerActive = AllQuiet with { LvlrGr = 4 };
        _ = ev.Evaluate(Composite, levelerActive, digu, T0);
        // Default 3 s warn window.
        var fired = ev.Evaluate(Composite, levelerActive, digu, T0.AddSeconds(3.1));

        var warn = fired.FirstOrDefault(f => f.Rule.Name == "digital.leveler.active");
        Assert.True(warn.Rule is not null);
        Assert.Equal(AudioChainSeverity.Warn, warn.Rule!.Severity);
        Assert.NotNull(warn.Apply);
        Assert.Equal("tx.leveler-max-gain-db", warn.Apply!.Value.Kind);
        Assert.Equal(0, warn.Apply!.Value.Value);
    }

    [Fact]
    public void DigitalMode_FlatChain_FiresNothing()
    {
        // Digital operator with a properly flat chain — no leveler /
        // CFC / Comp activity. Should be quiet.
        var ev = new RuleEvaluator();
        var digl = new RuleContext(RxMode.DIGL, HpsdrBoardKind.HermesLite2, Mox: true);

        for (int t = 0; t <= 6; t++)
        {
            var fired = ev.Evaluate(Composite, AllQuiet, digl, T0.AddSeconds(t));
            Assert.DoesNotContain(fired, f => f.Rule.Name == "digital.leveler.active");
            Assert.DoesNotContain(fired, f => f.Rule.Name == "digital.cfc.active");
            Assert.DoesNotContain(fired, f => f.Rule.Name == "digital.comp.active");
        }
    }

    [Fact]
    public void AmMode_AlcExcessive_MorePermissiveThanSsb()
    {
        var ev = new RuleEvaluator();
        var am = new RuleContext(RxMode.AM, HpsdrBoardKind.HermesLite2, Mox: true);

        // In SSB the base rule fires at GR > 6; in AM the carrier eats
        // 6 dB so the override moves the threshold to 10. At GR = 8 dB:
        //   - SSB would warn
        //   - AM should NOT warn (sits inside the new threshold)
        var amBusy = AllQuiet with { AlcGr = 8 };
        for (int t = 0; t <= 6; t++)
        {
            var fired = ev.Evaluate(Composite, amBusy, am, T0.AddSeconds(t));
            Assert.DoesNotContain(fired, f => f.Rule.Name == "am.alc.excessive");
        }

        // At GR = 12 dB — past the AM override threshold (10) — fires.
        var amHot = AllQuiet with { AlcGr = 12 };
        _ = ev.Evaluate(Composite, amHot, am, T0.AddSeconds(10));
        var fired10 = ev.Evaluate(Composite, amHot, am, T0.AddSeconds(13.1));
        Assert.Contains(fired10, f => f.Rule.Name == "am.alc.excessive");
    }

    [Fact]
    public void Hl2_DriveCeiling_FiresEarlierThanGenericBase()
    {
        var ev = new RuleEvaluator();
        var hl2 = new RuleContext(RxMode.USB, HpsdrBoardKind.HermesLite2, Mox: true);

        // Drive at 85% — past HL2 override (80) but below generic
        // base ceiling (99). Only the HL2 rule should fire.
        var nearCeiling = AllQuiet with { DrivePct = 85 };
        _ = ev.Evaluate(Composite, nearCeiling, hl2, T0);
        var fired = ev.Evaluate(Composite, nearCeiling, hl2, T0.AddSeconds(3.1));

        Assert.Contains(fired, f => f.Rule.Name == "hl2.wire.drive.ceiling");
        Assert.DoesNotContain(fired, f => f.Rule.Name == "wire.drive.ceiling");
    }

    [Fact]
    public void AnanBoard_DriveAt85Pct_DoesNotFireHl2Override()
    {
        var ev = new RuleEvaluator();
        var anan = new RuleContext(RxMode.USB, HpsdrBoardKind.Hermes, Mox: true);

        var nearCeiling = AllQuiet with { DrivePct = 85 };
        for (int t = 0; t <= 5; t++)
        {
            var fired = ev.Evaluate(Composite, nearCeiling, anan, T0.AddSeconds(t));
            Assert.DoesNotContain(fired, f => f.Rule.Name == "hl2.wire.drive.ceiling");
            Assert.DoesNotContain(fired, f => f.Rule.Name == "wire.drive.ceiling");
        }
    }

    [Fact]
    public void CompositeProvider_IncludesBaseAndOverrides()
    {
        var p = new BaseAndContextOverrideRuleProvider();
        Assert.True(p.Rules.Count >= BaseRules.All.Count + PerContextOverrides.All.Count);
        // Base rule names present:
        Assert.Contains(p.Rules, r => r.Name == "mic.low");
        Assert.Contains(p.Rules, r => r.Name == "pa.swr.runaway");
        // Override rule names present:
        Assert.Contains(p.Rules, r => r.Name == "cw.wdsp.bypass.mic");
        Assert.Contains(p.Rules, r => r.Name == "fm.bypass.leveler");
        Assert.Contains(p.Rules, r => r.Name == "digital.cfc.active");
        Assert.Contains(p.Rules, r => r.Name == "am.alc.excessive");
        Assert.Contains(p.Rules, r => r.Name == "hl2.wire.drive.ceiling");
    }
}

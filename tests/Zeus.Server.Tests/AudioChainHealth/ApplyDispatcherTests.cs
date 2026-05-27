// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.

using Microsoft.Extensions.Logging.Abstractions;
using Zeus.Contracts;
using Zeus.Server;
using Zeus.Server.AudioChainHealth;
using Xunit;

namespace Zeus.Server.Tests.AudioChainHealth;

/// <summary>
/// End-to-end tests for the apply dispatcher
/// (<c>ZeusEndpoints.ApplyAudioChainAction</c>). Each test fires a
/// rule-produced action and asserts the resulting RadioService state.
/// </summary>
public class ApplyDispatcherTests : IDisposable
{
    private readonly string _dbPath;

    public ApplyDispatcherTests()
    {
        _dbPath = Path.GetTempFileName();
    }

    public void Dispose()
    {
        try { if (File.Exists(_dbPath)) File.Delete(_dbPath); } catch { }
        try { if (File.Exists(_dbPath + ".pa")) File.Delete(_dbPath + ".pa"); } catch { }
    }

    private RadioService BuildRadio()
    {
        var dspStore = new DspSettingsStore(NullLogger<DspSettingsStore>.Instance, _dbPath);
        var paStore = new PaSettingsStore(NullLogger<PaSettingsStore>.Instance, _dbPath + ".pa");
        return new RadioService(NullLoggerFactory.Instance, dspStore, paStore);
    }

    [Fact]
    public void MicGainDb_RoutesToSetTxMicGain()
    {
        var radio = BuildRadio();
        var action = new AudioChainApplyAction("tx.mic-gain-db", 8);

        ZeusEndpoints.ApplyAudioChainAction(action, radio);

        Assert.Equal(8, radio.Snapshot().MicGainDb);
    }

    [Fact]
    public void MicGainDb_ClampsToRange()
    {
        // RadioService.SetTxMicGain clamps [-40, +10]. A rule that
        // produces an out-of-range target (defensive bug) should still
        // not be able to push the radio out of bounds.
        var radio = BuildRadio();
        ZeusEndpoints.ApplyAudioChainAction(new AudioChainApplyAction("tx.mic-gain-db", 99), radio);
        Assert.Equal(10, radio.Snapshot().MicGainDb);
        ZeusEndpoints.ApplyAudioChainAction(new AudioChainApplyAction("tx.mic-gain-db", -99), radio);
        Assert.Equal(-40, radio.Snapshot().MicGainDb);
    }

    [Fact]
    public void LevelerMaxGainDb_RoutesToSetTxLevelerMaxGain()
    {
        var radio = BuildRadio();
        ZeusEndpoints.ApplyAudioChainAction(
            new AudioChainApplyAction("tx.leveler-max-gain-db", 12.0), radio);
        Assert.Equal(12.0, radio.Snapshot().LevelerMaxGainDb);
    }

    [Fact]
    public void DrivePct_RoutesToSetDrive()
    {
        var radio = BuildRadio();
        // SetDrive needs a connected client to push the drive byte,
        // but the StateDto field is still mutated. Test exercises the
        // state plumbing — not the protocol-byte push.
        ZeusEndpoints.ApplyAudioChainAction(new AudioChainApplyAction("tx.drive-pct", 45), radio);
        Assert.Equal(45, radio.Snapshot().DrivePct);
    }

    [Fact]
    public void CfcPreCompDb_PreservesOtherCfcFields()
    {
        var radio = BuildRadio();
        // SetCfc requires a full CfcConfig — the dispatcher must
        // start from current (or Default), swap PreCompDb only, and
        // push the whole thing back. Verify the rest of the config
        // didn't get reset to Default along the way.
        var initial = CfcConfig.Default with
        {
            Enabled = true,
            PostEqEnabled = true,
            PrePeqDb = 4.0,
        };
        radio.SetCfc(new CfcSetRequest(initial));

        ZeusEndpoints.ApplyAudioChainAction(
            new AudioChainApplyAction("tx.cfc-pre-comp-db", 5.0), radio);

        var after = radio.Snapshot().Cfc!;
        Assert.Equal(5.0, after.PreCompDb);
        Assert.True(after.Enabled);
        Assert.True(after.PostEqEnabled);
        Assert.Equal(4.0, after.PrePeqDb);
        Assert.Equal(10, after.Bands.Length);
    }

    [Fact]
    public void UnknownKind_ThrowsNotSupportedException()
    {
        var radio = BuildRadio();
        Assert.Throws<NotSupportedException>(() =>
            ZeusEndpoints.ApplyAudioChainAction(
                new AudioChainApplyAction("tx.this-kind-does-not-exist", 1), radio));
    }
}

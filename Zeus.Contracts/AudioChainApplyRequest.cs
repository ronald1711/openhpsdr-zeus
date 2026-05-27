// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF) and contributors.

namespace Zeus.Contracts;

/// <summary>
/// Body of <c>POST /api/audio-chain/apply</c>. The operator clicks
/// Apply on a verdict in the factory widget; the frontend POSTs only
/// the <see cref="StageId"/>. The server reads its in-process apply
/// cache (populated by <c>AudioChainHealthService</c>) for that
/// stage's current absolute target and routes it through the
/// dispatcher (zeus-pgn) to the matching backend setter.
///
/// <para>Per ADR-0003, the absolute target value is NOT on the wire —
/// only the stage id is. This keeps the operator-visible action
/// idempotent: clicking twice fires the same setter call with the
/// same value (until the verdict clears and re-fires with a new
/// computed target).</para>
/// </summary>
public sealed record AudioChainApplyRequest(AudioChainStageId StageId);

/// <summary>
/// Response shape from a successful apply: the dispatcher's stable
/// Kind discriminator that fired, plus the absolute value applied —
/// surfaces back to the frontend so a future audit / toast can show
/// "mic gain set to 28 dB" without having to re-evaluate locally.
/// </summary>
public sealed record AudioChainApplyResponse(string Kind, double Value);

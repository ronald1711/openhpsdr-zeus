---
name: create-plugin
description: Scaffold a new Openhpsdr-Zeus plugin from scratch. Creates the .NET class library, plugin.json manifest, optional Vite UI, and a registry.json entry ready for a PR to Kb2uka/openhpsdr-zeus-plugins. Pass the plugin name and category as args, e.g. /create-plugin MyAmplifier amplifier
---

# /create-plugin — scaffold an Openhpsdr-Zeus plugin

Creates a fully wired Zeus plugin project: .NET backend, `plugin.json` manifest,
optional React UI panel, and a draft registry entry.

## Arguments

```
/create-plugin <Name> <category> [--ui] [--audio <slot>] [--radio] [--control]
```

| Arg | Description | Default |
|-----|-------------|---------|
| `<Name>` | PascalCase plugin name (e.g. `MyAmplifier`) | required |
| `<category>` | Registry category: `amplifier` `audio` `switch` `tuner` `tools` | required |
| `--ui` | Scaffold a Vite + React UI panel | omitted = no UI |
| `--audio <slot>` | DSP slot: `tx.post-leveler` `tx.pre-cfc` `rx.post-demod` | omitted = no audio |
| `--radio` | Request `ReadRadioState` capability | omitted |
| `--control` | Request `ControlRadio` capability (implies `--radio`) | omitted |

## Plugin architecture

A Zeus plugin is a **.NET class library** (`.dll`) plus a `plugin.json` manifest,
packaged together as a zip file.

```
<Name>/
  <Name>.csproj          ← .NET class library (net10.0)
  <Name>Plugin.cs        ← implements IZeusPlugin
  plugin.json            ← manifest (shipped in the zip)
  ui/                    ← only when --ui
    src/
      Panel.tsx
      index.ts
    vite.config.ts
    package.json
```

### SDK interfaces (Zeus.Plugins.Contracts)

```csharp
public interface IZeusPlugin
{
    // Called once after load. Host applies 10-second timeout.
    Task InitializeAsync(IPluginContext context, CancellationToken ct);
    // Called once before unload. Host applies 5-second timeout.
    Task ShutdownAsync(CancellationToken ct);
}

public interface IPluginContext
{
    string PluginId { get; }
    PluginManifest Manifest { get; }
    ILogger Logger { get; }
    string PluginRootPath { get; }          // always writable, no capability needed
    PluginCapabilities GrantedCapabilities { get; }
    IPluginSettings Settings { get; }       // key/value, LiteDB-backed per plugin
    IRadioStateReader? Radio { get; }       // null unless ReadRadioState granted
    IRadioController? RadioController { get; } // null unless ControlRadio granted
}

public interface IRadioStateReader
{
    long FrequencyHz { get; }
    string Mode { get; }
    string Band { get; }
    bool Mox { get; }
    event Action<long> FrequencyChanged;
    event Action<string> ModeChanged;
    event Action<bool> MoxChanged;
}

public interface IRadioController
{
    Task SetFrequencyAsync(long hz, CancellationToken ct = default);
    Task SetModeAsync(string mode, CancellationToken ct = default);
    Task SetMoxAsync(bool keyed, CancellationToken ct = default);
}
```

## Output directory

Plugins live in the `openhpsdr-zeus-plugins` registry repo, which is expected as a
sibling of the main Zeus repo:

```
C:\projecten\
  openhpsdr-zeus\
  openhpsdr-zeus-plugins\   ← clone of Kb2uka/openhpsdr-zeus-plugins
```

Target: `C:\projecten\openhpsdr-zeus-plugins\<category>s\<Name>\`
(pluralise: amplifier→amplifiers, switch→switches, tuner→tuners, audio→audio, tools→tools)

If the plugins repo isn't cloned locally, scaffold into
`C:\projecten\<Name>-plugin\` and tell the user to clone the registry repo first.

## Step 1 — `<Name>.csproj`

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName><Name></AssemblyName>
    <RootNamespace>Openhpsdr.Zeus.Plugins.<Name></RootNamespace>
    <IsPackable>false</IsPackable>
    <CopyLocalLockFileAssemblies>false</CopyLocalLockFileAssemblies>
  </PropertyGroup>
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />
  </ItemGroup>
  <!-- Sibling clone until Zeus.Plugins.Contracts ships on NuGet -->
  <ItemGroup>
    <ProjectReference
      Include="..\..\..\openhpsdr-zeus\Zeus.Plugins.Contracts\Zeus.Plugins.Contracts.csproj">
      <Private>false</Private>
    </ProjectReference>
  </ItemGroup>
  <ItemGroup>
    <Content Include="plugin.json" CopyToOutputDirectory="PreserveNewest" />
    <Content Include="ui\**\*.js" CopyToOutputDirectory="PreserveNewest"
             Condition="Exists('ui')" />
  </ItemGroup>
</Project>
```

## Step 2 — `<Name>Plugin.cs`

```csharp
// SPDX-License-Identifier: GPL-2.0-or-later
using Microsoft.Extensions.Logging;
using Zeus.Plugins.Contracts;

namespace Openhpsdr.Zeus.Plugins.<Name>;

public sealed class <Name>Plugin : IZeusPlugin
{
    private IPluginContext? _ctx;

    public async Task InitializeAsync(IPluginContext context, CancellationToken ct)
    {
        _ctx = context;
        context.Logger.LogInformation("{Plugin} initialised", context.PluginId);

        // ReadRadioState — only present when capability was granted:
        if (context.Radio is { } radio)
            radio.FrequencyChanged += hz =>
                context.Logger.LogDebug("Frequency → {Hz} Hz", hz);

        // ControlRadio — only present when capability was granted:
        // if (context.RadioController is { } ctrl)
        //     await ctrl.SetMoxAsync(false, ct);

        // PersistSettings — read a saved value:
        // var host = await context.Settings.GetAsync<string>("host", ct);

        await Task.CompletedTask;
    }

    public Task ShutdownAsync(CancellationToken ct)
    {
        _ctx?.Logger.LogInformation("{Plugin} shutting down", _ctx.PluginId);
        return Task.CompletedTask;
    }
}
```

Add `--radio` / `--control` sections only when those flags were requested.

## Step 3 — `plugin.json`

ID convention: `com.openhpsdr.zeus.plugins.<namelower>` (all lowercase, dots only).

```json
{
  "schemaVersion": 1,
  "id": "com.openhpsdr.zeus.plugins.<namelower>",
  "name": "<Human-readable name>",
  "version": "0.1.0",
  "author": "<author>",
  "description": "<one-line description>",
  "homepage": "https://github.com/<author>/<namelower>",
  "license": "GPL-2.0-or-later",
  "sdk": { "abi": 1, "minVersion": "1.0.0" },
  "entrypoint": {
    "assembly": "<Name>.dll",
    "type": "Openhpsdr.Zeus.Plugins.<Name>.<Name>Plugin"
  },
  "capabilities": [],
  "permissions": {}
}
```

**Capability → permissions key:**

| Capability | Add to `permissions` |
|------------|---------------------|
| `ReadRadioState` | — |
| `ControlRadio` | — |
| `NetworkAccess` | `"network": true` |
| `FileSystemRead` | `"fileSystemRead": true` |
| `FileSystemWrite` | `"fileSystemWrite": true` |
| `PersistSettings` | — |
| `AudioStream` | — |

**UI block** (only when `--ui`):
```json
  "ui": {
    "modules": ["ui/<namelower>.es.js"],
    "panels": [
      {
        "id": "<namelower>.main",
        "title": "<Name>",
        "icon": "Zap",
        "slot": "workspace.<category>",
        "category": "<category>s"
      }
    ]
  }
```

**Audio block** (only when `--audio <slot>`):
```json
  "audio": { "slot": "<slot>", "channels": 2, "sampleRate": 48000 }
```

## Step 4 — UI scaffold (only when `--ui`)

### `ui/package.json`
```json
{
  "name": "<namelower>-ui",
  "private": true,
  "scripts": { "dev": "vite", "build": "tsc -b && vite build" },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

### `ui/vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => '<namelower>.es.js',
    },
    outDir: '../ui',
    emptyOutDir: false,
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: { globals: { react: 'React', 'react-dom': 'ReactDOM' } },
    },
  },
});
```

### `ui/src/index.ts`
```typescript
export { mount } from './Panel';
```

### `ui/src/Panel.tsx`
```tsx
import { useEffect, useState } from 'react';

// Zeus injects window.__zeusPluginBridge for inter-panel messaging.
// Fetch /api/plugins/<id>/... for your own backend endpoints.

export function mount(container: HTMLElement) {
  import('react-dom/client').then(({ createRoot }) => {
    createRoot(container).render(<Panel />);
  });
}

function Panel() {
  const [status, setStatus] = useState('initialising…');
  useEffect(() => { setStatus('ready'); }, []);
  return (
    <div style={{ padding: 12, color: 'var(--fg-0)', fontFamily: 'var(--font-sans)' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--accent)' }}>
        <Name>
      </h3>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-2)' }}>{status}</p>
    </div>
  );
}
```

Always use Zeus CSS tokens (`var(--accent)`, `var(--fg-0)`, `var(--bg-1)`, etc.) —
never hardcoded hex. Full token reference: `zeus-web/src/styles/tokens.css`.

## Step 5 — Draft registry entry

If `C:\projecten\openhpsdr-zeus-plugins\registry.json` exists, append this entry to
its top-level array:

```json
{
  "id": "com.openhpsdr.zeus.plugins.<namelower>",
  "name": "<Human-readable name>",
  "description": "<one-line description>",
  "author": "<author>",
  "license": "GPL-2.0-or-later",
  "homepage": "https://github.com/<author>/<namelower>",
  "categories": ["<category>"],
  "verified": false,
  "versions": [
    {
      "version": "0.1.0",
      "sdkAbi": 1,
      "sdkMinVersion": "1.0.0",
      "platforms": ["any"],
      "downloadUrl": "https://github.com/<author>/<namelower>/releases/download/v0.1.0/<namelower>-0.1.0.zip",
      "sha256": "<fill in after building: sha256sum <namelower>-0.1.0.zip>"
    }
  ]
}
```

## Step 6 — Build and package instructions (show to user)

```powershell
# Build
dotnet publish <Name>/<Name>.csproj -c Release -o dist/<Name>

# Build UI (if --ui)
cd <Name>/ui && npm install && npm run build && cd ../..

# Package
Compress-Archive -Path dist/<Name>/* -DestinationPath <namelower>-0.1.0.zip

# SHA-256 for registry.json
(Get-FileHash <namelower>-0.1.0.zip -Algorithm SHA256).Hash.ToLower()
```

## Step 7 — Summary (always print at the end)

```
Plugin scaffolded: <Name>
  Backend:   <path>/<Name>.csproj + <Name>Plugin.cs
  Manifest:  <path>/plugin.json
  UI:        <path>/ui/  (if --ui, run: cd ui && npm install && npm run build)
  Registry:  entry drafted in registry.json (fill sha256 + downloadUrl after build)

Next steps:
  1. Implement your logic in <Name>Plugin.cs
  2. dotnet build — verify it compiles
  3. dotnet publish → zip → sha256sum → update registry.json
  4. Open a PR to https://github.com/Kb2uka/openhpsdr-zeus-plugins
```

## Do NOT

- Do **not** reference `Zeus.Server.Hosting` or `Zeus.Contracts` — only
  `Zeus.Plugins.Contracts` is the public SDK.
- Do **not** request `ControlRadio` unless the plugin genuinely needs to
  key the radio or change frequency — it requires explicit user permission.
- Do **not** hardcode IP addresses or ports — read from `context.Settings`.
- Do **not** set `"verified": true` — only the curator (Brian, EI6LF) sets that.
- Do **not** use hardcoded hex colours in the UI panel — always CSS tokens.
- Do **not** commit secrets or credentials to the plugin source.

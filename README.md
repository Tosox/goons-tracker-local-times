# <img src="assets/icon.png" height="40" /> Goons Tracker – Local Times

[![](https://img.shields.io/github/languages/code-size/Tosox/goons-tracker-local-times?label=Code%20size&style=for-the-badge)](https://github.com/Tosox/goons-tracker-local-times)
[![](https://tokei.rs/b1/github/Tosox/goons-tracker-local-times?label=Total%20lines&style=for-the-badge)](https://github.com/Tosox/goons-tracker-local-times)
[![](https://img.shields.io/github/downloads/Tosox/goons-tracker-local-times/total?label=Downloads&style=for-the-badge)](https://github.com/Tosox/goons-tracker-local-times/releases)

## 📜 Description

**Goons Tracker – Local Times** is a Tampermonkey userscript that automatically converts timestamps on EFT Goons tracking websites into your local time or shows how long ago they happened.

### Supported websites
- https://www.goon-tracker.com
- https://www.tarkov-goon-tracker.com

## 🔧 Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Go to the latest release of [`goons-tracker-local-times.user.js`](https://github.com/Tosox/goons-tracker-local-times/releases/latest/download/goons-tracker-local-times.user.js)
3. Press the **Install** button

That’s it! timestamps will now be shown in your local time automatically.

## 🛠️ Configuration

The script uses pattern-based formatting for maximum control and predictability.

### Display mode

You can switch between two display modes from the Tampermonkey menu:

1. Open the Tampermonkey extension
2. Under **Goons Tracker - Local Times**
3. Select **“Toggle display mode”**

Available modes:
- **Local time**: shows the converted timestamp in your local timezone
- **Relative time**: shows elapsed time such as `53s ago`, `2min ago` or `1h ago`

### Custom date pattern

You can define your own format via the Tampermonkey menu:

1. Open the Tampermonkey extension
2. Under **Goons Tracker - Local Times**
3. Select **“Set date pattern”**

#### Default behavior
- On first run, a default date pattern is automatically guessed based on your browser’s locale
- This pattern is stored locally and used for all conversions
- If the stored pattern is invalid, the script safely falls back to the default

#### Supported tokens
| Token | Meaning |
|-----|--------|
| `yyyy` | 4-digit year |
| `yy` | 2-digit year |
| `MM` / `M` | Month |
| `dd` / `d` | Day |
| `HH` / `H` | Hour (24h) |
| `hh` / `h` | Hour (12h) |
| `mm` / `m` | Minutes |
| `ss` / `s` | Seconds |
| `a` | AM / PM |

#### Examples
- **24h format**  
  `dd.MM.yyyy, HH:mm:ss`
- **12h format**  
  `MM/dd/yyyy, hh:mm:ss a`

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

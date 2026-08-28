# arduino-cli

The microcontroller toolchain for wirebench's MCU workbench, through
[arduino-cli](https://arduino.github.io/arduino-cli/) — a separate program
run in its own process. This plugin is the *declaration*: how to find it, how
to run it, and where wirebench may fetch it from (the Arduino project's own
release page, pinned by checksum). After the download, arduino-cli's own
`core install arduino:avr` fetches the AVR core — which is where avr-gcc comes
from, so one install lights the *avr-gcc* row too. **Nothing here is
arduino-cli itself**, and wirebench neither bundles it nor is part of it.

## What you get

- The *Microcontroller toolchain* row in Preferences ▸ Plugins: detection,
  *Set up*, Browse…, the version check, and whether the AVR core is there.
- **Compile** in the MCU workbench for `.ino` sketches — `Wire.h` and `SPI.h`
  come with the core, which is what makes the I²C and SPI peripherals usable
  without hand-rolled register code.

## Licences

The plugin is GPL-3.0-or-later with the linking exception in
[EXCEPTION.md](../../EXCEPTION.md). arduino-cli is GPL-3.0; the AVR core it
fetches carries avr-gcc and avrdude under theirs. All obtained by you, from
their authors — wirebench conveys none of it.

## Why this exists alongside the copy in the app

The same declaration ships in wirebench's catalog (MIT, its own text), so a
fresh install works offline against a toolchain you already have. This
published copy is the one that can move between app releases: a wirebench
build pins the version it was tested with, and installing it replaces the
built-in row. It is first-party only when its content matches that pin.

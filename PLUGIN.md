# WorkshopMotors (Motors)



Page `/Plugins/Motors`. Shows how the motors are doing (state, current, speed, pulses, RPM, driver status), draws live charts, lets you release or enable motors, and has start-up tools: advisor (speed and acceleration limits per mode), axis test, measure the pulse ceiling of your board and StallGuard crash detection for the free (no-limits) jog.

Version documented: 2.6.x on DWC 3.6.3, machine powered off ("Power supply off": no motor power), so all values are at rest.

SAFETY NOTE of the plugin: it never writes driver registers (`M569.2` with a value can damage a TMC chip). The only `M569.2` is a read of the raw status register. Everything else comes from the object model and `M122`.

## 1. Requirements

1. WorkshopService running. 2. Duet 3 board (6HC uses TMC2160A drivers). M122 and the raw register only reach local drivers (CAN address 0); expansion board drivers show "unsupported".

## 2. Install

1. Install WorkshopService.
2. DWC > Settings > Plugins > Install `WorkshopMotors-<ver>.zip`; Start if needed.
3. Reload DWC. Open *Plugins > Motors*.
4. Verify: header shows "All fine", "Power supply off" or "Live", and the motor cards appear.

## 3. Functions

The page is "Motors" (side menu: Plugins > Motors). Its side bar has two groups: "Health" (State, Details, Charts, Release / enable) and "Commissioning" (Advisor, Test, Measure, Crash). Names show when the bar is open, icons only when collapsed with the double arrow. Red rectangles mark the control described.

### Page header

#### State chips
- What: "All fine" (or a warning), "Motors without faults" and "Live" (the data is being read now).
- Where: top right of the page header (any picture).
- How: read only.

### Health

![State](https://raw.githubusercontent.com/jhonf441/WorkshopMotors/main/img/01-state-axis-cards.png)

Picture 1: one card per axis.

#### State of each axis
- What: one card per axis and extruder (here X, Y, Z): a chip "Holding" (or "No power" when the motor supply is off), "Homed", "No faults", the speed against its maximum, the current in mA (here 1856 mA, 69 % of M906) and its percentage at rest (71 %), the drivers (Z has 0.5 and 0.4) and the board.
- Where: State (picture 1).
- How: read only.

#### Link "Release or enable"
- What: jumps to the Release / enable entry.
- Where: under the cards (red rectangle, picture 1).
- How: press it.

![Details](https://raw.githubusercontent.com/jhonf441/WorkshopMotors/main/img/02-details-pulses.png)

Picture 2: "Board and pulse generation" and the first axis.

#### Board and pulse generation
- What: "Late step pulses (M122 hiccups)" (0 means the board generates every step on time), the steps per second the board generates now (kHz) against the reference of the board, the requested / cruise speed and the kinematics (Cartesian: each motor is independent).
- Where: Details, top row of tiles (red rectangle, picture 2).
- How: read only.

#### Per axis: speed, pulses, RPM, current and driver
- What: for each axis: the speed against its maximum, pulses per motor against the board ceiling (here 12 kHz), motor RPM (calculated with the full steps per turn of each motor: 200 unless you say otherwise, see "Steps per revolution" below), configured current (100 % when moving, 71 % at rest) and the driver line with its alerts and firmware status. RRF does not publish the instantaneous speed per axis: the plugin uses the top speed of the current move (exact for single-axis moves, conservative for diagonals).
- Where: Details, one block per axis (picture 2).
- How: read only.

#### See in Charts
- What: opens the chart of that axis.
- Where: link at the right of each axis title (red rectangle, picture 2).
- How: press it.

![Charts](https://raw.githubusercontent.com/jhonf441/WorkshopMotors/main/img/03-charts.png)

Picture 3: "Charts": chooser, quick buttons and period (red rectangles).

#### Charts to show
- What: a dropdown to pick the charts (here Speed of X, Y and Z); each chart shows max / min / avg and a "Scale: linear" chip; the cross closes one.
- Where: top of Charts (red rectangle, picture 3).
- How: open the dropdown and tick the charts; press the cross to remove one.

#### Quick buttons
- What: "Speed of all", "Current of all", "StallGuard of all", "Board (pulses, voltage, temperature)", "All" and "Remove all".
- Where: row under the dropdown (red rectangle, picture 3).
- How: press one.

#### Period and layout
- What: the period of the charts (1 min, 5 min, 15 min, 30 min, 1 h) and one or two columns.
- Where: right of the quick buttons (red rectangle, picture 3).
- How: press a period or a layout icon.
- Watch out: pinch gestures are captured by the chart (the page does not zoom while touching it).

![Release](https://raw.githubusercontent.com/jhonf441/WorkshopMotors/main/img/04-release-enable.png)

Picture 4: "Release / enable": the warning, the tick "Understood", and the buttons per axis (red rectangles on the tick and on the lower buttons: not pressed).

#### Release or enable one axis
- What: "Release" cuts the current of that motor (no force, it can be moved by hand); "Enable" turns it on again. Each axis has a checkbox and its own two buttons.
- Where: Release / enable, one card per axis (picture 4).
- How: 1. Tick "Understood: I will release the motors carefully". 2. Press "Release" or "Enable" on the axis.
- Watch out: released motors have NO force: the head or gantry move by hand and the position (homing) is lost; a vertical axis (Z) can fall under its own weight, hold or support it first; while released do not use the jog: any movement enables them again by itself. To stop it press Enable and home. In case of danger use the Emergency Stop.

#### Release or enable selected / all
- What: tick several axes and press "Release selected" or "Enable selected"; "Select all" and "None" change the selection; "Release all" and "Enable all" act on every axis.
- Where: bottom of Release / enable (red rectangle, picture 4).
- How: 1. Tick the "Understood" box. 2. Choose the axes. 3. Press the button.
- Watch out: same risks as above; not pressed.

#### Idle current note
- What: motors at rest for more than 30 s drop to 30 % of their current (M906 I); they stay enabled and keep their position.
- Where: line under the warning (picture 4).

#### Steps per revolution of each motor
- What: the RPM shown is the pulses per second divided by (full steps per turn x microsteps). RepRapFirmware does not know the motor, so the number must come from you: 200 for a 1.8 degree motor (the usual), 400 for a 0.9 degree one. With the wrong number the RPM comes out half or double. It does not change any move, current or limit: it only changes the RPM text.
- Where: Motors > Advisor > "Your motors data", column "Steps per revolution" (one row for the general data, one per axis and one per driver; an empty box uses the general row, and an empty general row uses 200).
- How: type 400 in the row of the axis that has a 0.9 degree motor and press the button that saves the motor data of that table; the RPM tile of that axis in Details says "with motors of 400 steps per revolution".
- Watch out: whole-machine default for a service without this page: `motor_status.full_steps_per_rev` in the service `config.json`.

### Commissioning

![Advisor](https://raw.githubusercontent.com/jhonf441/WorkshopMotors/main/img/05-advisor-messages.png)

Picture 5: "Advisor": one message per axis.

#### Advisor: current and pulse margin
- What: compares the nominal current with what the motor is set to (recommended 50-85 % of the rated current) - it asks for the rated current when there is no motor data -, tells if the board has margin in pulses (here 14 % of the reference for X and Y) and says "no tests in this mode" for axes with no test.
- Where: Advisor, top (picture 5).
- How: read it; follow the hints ("Run a ladder in the Test section").

#### Speed and acceleration limits per mode
- What: a table with speed, acceleration, jerk, time to reach speed and pulses at maximum speed per mode (Now = what the machine uses, Laser, CNC, 3D printing).
- Where: Advisor, "Speed and acceleration limits" (scroll down; heading at the bottom of picture 5).
- How: read only.

![Test](https://raw.githubusercontent.com/jhonf441/WorkshopMotors/main/img/06-axis-test-form.png)

Picture 6: "Test": the condition chips, the axis and test type buttons, the fields and "Start test" (red rectangles).

#### Axis test (speed ladder, acceleration ladder, one test)
- What: the machine gently touches the endstop of the axis and notes where it thinks it is (without homing again); then goes back and forth at the test speed and acceleration and touches the endstop again. If the second measurement differs by more than 0.1 mm the motor lost steps. The test limits are removed at the end. Choose the axis (X, Y, Z), the type (Speed ladder, Acceleration ladder, One test) and the fields From / To / Step (mm/min), Acceleration, Travel and Back-and-forth moves. The page says how many tests and how long ("7 test(s), ~6 min. Stops by itself at the first one that loses steps").
- Where: Test (picture 6).
- How: 1. Check the chips are green (Power supply on, Home X, No job running, Measurable axis). 2. Clear the work area and keep a hand near the emergency stop. 3. Choose axis, type and values. 4. Press "Start test".
- Watch out: it MOVES the machine at speed. To stop NOW use the Emergency Stop at the top.

#### Saved results
- What: the results of the tests, stored in `sys/workshop/data/axis-test.csv`; the "Refresh" link reads them again.
- Where: bottom of Test (picture 6).
- How: press "Refresh".

![Measure](https://raw.githubusercontent.com/jhonf441/WorkshopMotors/main/img/07-pulse-ceiling-measure.png)

Picture 7: "YOUR board's pulse ceiling" (red rectangles on the axis buttons and "Measure the ceiling").

#### Measure the pulse ceiling
- What: finds the highest step rate your board really sustains: it raises the rate from "From (kHz)" to "To (kHz)" in "Step (kHz)" over a "Travel (mm)" and counts M122 hiccups (here 50 to 300 kHz in steps of 25 over 300 mm; the steps above 200 kHz are not tested because the axis would have to go faster than its maximum speed). The result is the highest loop frequency observed, not a datasheet number.
- Where: Measure (picture 7).
- How: 1. Check the chips (Power supply on, Home X, No job running, The service counts hiccups). 2. Choose the axis. 3. Press "Measure the ceiling".
- Watch out: it moves the axis.

#### References to compare
- What: a table of values from other boards (board, firmware, timing, case, kHz per motor, source); a copy is included in the plugin.
- Where: Measure, below the button (picture 7, bottom).
- How: read only.

![Crash](https://raw.githubusercontent.com/jhonf441/WorkshopMotors/main/img/08-crash-detection-top.png)

Picture 8: "Crash": tabs "Jog without limits" and "Sensorless endstop" (red rectangle) and the current values.

#### Crash detection of the jog without limits
- What: in that mode the driver (StallGuard) stops the jog if a motor jams against something hard (a stop, the end of the frame). It does NOT protect people and does not work to stop it by hand: that is what STOP and the Emergency Stop are for. The panel shows the maximum speed of the free jog (25 mm/s), "detects from" per axis (20 mm/s), the sensitivity (8) and the current in this mode (50 %).
- Where: Crash > tab "Jog without limits" (picture 8).
- How: read it.

#### Detect from (mm/s)
- What: the speed from which the detection works; lower also detects when moving slowly but gives more false stops.
- Where: field under the values (picture 8).
- How: type the value, then calibrate again: the previous sensitivity is not valid for a new speed.
- Watch out: a change needs a new calibration.

#### Sensorless endstop tab
- What: the same kind of setting for the sensorless endstop.
- Where: second tab of Crash (red rectangle, picture 8).
- How: press the tab.

![Calibrate](https://raw.githubusercontent.com/jhonf441/WorkshopMotors/main/img/09-crash-calibration-checklist.png)

Picture 9: the checklist before calibrating and the "Calibrate" button.

#### Calibrate the sensitivity
- What: tunes the detection against hard stops. The page lists what happens: the machine moves by itself back and forth about 12 cm in X; Z does not move; a real crash does NOT stop the machine during the calibration (the detection only counts the warnings: the test looks for FALSE warnings with nothing in the way); the motors run with the reduced current of the free-jog mode (50 %); keep a hand near the Emergency Stop.
- Where: Crash, below the values (picture 9).
- How: 1. Clear the path and raise the tool away from the material. 2. Tick "Understood: I cleared the path and my hand is near the emergency stop". 3. Check the chips (Home X, Machine free, Without-limits mode off, Speed high enough to measure). 4. Choose X, Y or X and Y. 5. Press "Calibrate".
- Watch out: it moves the machine by itself.

## 4. Settings

| Setting | Meaning | Default | If wrong |
|---|---|---|---|
| Free jog max speed | Speed of the no-limits mode | 25 mm/s | Too high: harder crashes |
| Detect from (X, Y) | Speed above which StallGuard is read | 20 mm/s | Too low: false stops |
| Sensitivity | StallGuard threshold | 8 (calibrated) | Too high: no detection; too low: false stops |
| Motor current in free mode | Current used while jogging free | 50 % | Higher: more force on a crash |
| Test ranges (from, to, step, accel, travel, round trips) | Axis test | 4500-18000 step 2250 mm/min, 300 mm/s2, 300 mm, 5 | Too aggressive loses steps |
| Pulse ceiling (kHz range) | Measure range | 50-300 step 25 | Over 200 kHz is not tested |

## 5. Roles

Read: any role. Tests, calibration and release/enable: operator or higher (they move or release the machine); advisor settings that write limits: technician. Without users everybody is admin.

## 6. API operations used

`view.heartbeat`, `activity.log` (records tests), `motors.*` (the Jog plugin uses `motors.disable`); reads come from the shared object model published by the service.

## 7. Troubleshooting

1. "Power supply off": turn the motor power on from the Control bar before tests.
2. "Not homed": home X first (the tests need it).
3. Drivers of an expansion board show "unsupported": expected.
4. "SG min" can be a number or "n/a": both are valid.
5. False stops in the free jog: re-calibrate sensitivity or raise "detects from".

<!-- permissions:start -->

## Permissions and what it changes

Risk: **Medium (its Test tab moves an axis; the stall detection changes the current of a driver)**. Read this before installing; the full document is `security.md` of the Workshop plugins.

**DSF permissions:** none. It is a page of DWC (it runs in your browser) and everything it does goes through the API of `WorkshopService`, which applies the roles (viewer, operator, technician, administrator) in the server.

**Depends on:** `WorkshopService` (install it first, uninstall it last).

**Files it writes:**
- its results in `0:/sys/workshop/` (`axis-test.csv`, step ceiling)
- the saved copy of the shared pulse table in the browser (localStorage)

**Safety notes:**
- It never writes driver registers (`M569.2` with a value is not in the code). The shared reference table is read from `data/references.json` of this repository.

Uninstalling removes the plugin folder; your data in `0:/sys/workshop/` and `/opt/dsf/conf/workshop-*.json` stays.

<!-- permissions:end -->

## 8. Limits

Local drivers only; RPM uses the steps per revolution you set for each motor (200 when you set none: RRF does not know the motor); pulse capacity is observed, not a datasheet number; StallGuard does not protect people.

## Pulse ceiling reference table (shared with everybody)

The "References to compare" table of the Measure tab compares the pulse ceiling you measured with other boards. It comes from ONE file in this repository, [`data/references.json`](data/references.json). The page reads it every time it opens and with the button **Update table**; it keeps the last good copy in the browser, and a copy also travels inside the plugin, so it works with no internet. The line under the table says when it was updated, or that it could not be read (no internet, or the repository is not public yet) and which copy is shown. **Download CSV** and **Download JSON** save the table as it is shown (CSV for a spreadsheet, JSON in the same format as the repository file).

To add your measurement: press **Share my measurement** (it opens an issue already filled with your board, firmware, timing, axis and ceiling in kHz). The owner adds the row to `data/references.json` and everybody gets it the next time the page opens.

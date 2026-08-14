export function DataHelpPane() {

    // _rs: Rotate stabilizers independently of the key (useful for bottom row stabs)
    // _rc: Rotate switch cutouts independently of the key
    // _ss: Shift stabilizers (Mainly for 6U off-center). false = Unshifted (default), true = Shifted
    // _so: Skip automatic orientation fix 
    //      By default, the plategen will auto-rotate vertically tall switches so that they are treated as wide keys rotated 90deg
    //      Setting _so: true will skip this fix

    return (
        <div>
            <h2>Customizing data</h2>
            <p>The plate generator offers a few additional options for tuning the plate output.<br />
                These can be added to the input KLE data as KLE flags similar to <code>{`{w:Width}`}</code>.</p>
            <p>For example, to add the <code>_rs: 180</code> flag to rotate a bottom row spacebar stabilizer, first spot the existing <code>w:6.25</code> or similar spacebar modifier, then add the flag in typical JSON fashion.<br />
                The result should look something like <code>{`{w:6.25,_rs:180}`}</code> when complete.</p>
            <br />
            <h3>Available plategen flags</h3>
            <br />
            <h4 style={{ textTransform: "lowercase" }}>_rs</h4>
            <p>Value type: Numerical</p>
            <p>Rotates the stabilizers by degrees specified independently of the key.</p>
            <br />
            <h4 style={{ textTransform: "lowercase" }}>_rc</h4>
            <p>Value type: Numerical</p>
            <p>Rotates the switch cutout by degrees specified independently of the rotation cluster it is in.</p>
            <br />
            <h4 style={{ textTransform: "lowercase" }}>_ss</h4>
            <p>Value type: Boolean</p>
            <p>Toggle shifted stabilizers to enable off-center 6U stabilizers.</p>
            <br />
            <h4 style={{ textTransform: "lowercase" }}>_so</h4>
            <p>Value type: Boolean</p>
            <p>Toggle automatic orientation fix.
                By default, plategen will automatically rotate switch cutouts and add stabilizers when keys are taller than wide.
            </p>
            <br />
            <h3>Outline corners (from KLE CAD)</h3>
            <p>In <a href="https://avaviel.github.io/keyboard-layout-editor-CAD/" target="_blank" rel="noreferrer">KLE CAD</a>, use <strong>Add Corner</strong> and set each marker&apos;s zone. Corners are not switch holes. Official keyboard-layout-editor.com will not accept these CAD fields.</p>
            <h4 style={{ textTransform: "lowercase" }}>_z</h4>
            <p>Value type: Numerical (zone number, 1+)</p>
            <p>Outline island / segment. All corners with the same zone are connected in order.</p>
            <h4 style={{ textTransform: "lowercase" }}>_zi</h4>
            <p>Value type: Numerical (order in that zone, 0+)</p>
            <p>Walk order around the outline. Example: <code>{`{d:true,w:0.5,h:0.5,_z:1,_zi:0},"Z1.0"`}</code></p>
            <p>If a zone has at least two corners, that polygon replaces the old single bounding box.</p>
        </div>
    )
}

export function SwitchCutoutPane() {

    return (
        <div>
            <h2>Switch Cutout Types</h2>
            <br />
            <h4>Cherry MX Basic</h4>
            <p>14 x 14 mm</p>
            <p>The standard switch cutout for modern MX-style switches.</p>
            <br />
            <h4>Alps SKCM/L</h4>
            <p>15.5 x 12.8 mm</p>
            <p>For Alps SKCM and SKCL series switches.</p>
            <br />
            <h4>Choc CPG1350</h4>
            <p>14 x 14mm</p>
            <p>For Kailh Choc V1 CPG1350 switches with a travel distance of 3.0mm.<br />
            Identical cutout to basic Cherry MX switches.</p>
            <br />
            <h4>Mini Choc CPG1232</h4>
            <p>13.7 x 12.7 mm</p>
            <p>For Choc CPG1232 switches, marketed by Kailh as "Mini Choc".<br />
                Has a travel distance of 2.4mm.</p>
            <br />
            <h4>Omron B3G/B3G-S</h4>
            <p>13.5 x 13.5 mm</p>
            <p>For Omron B3G and B3G-S series switches.</p>
            <br />
            <h4>Alps SKCP</h4>
            <p>16 x 16 mm</p>
            <p>For Alps SKCP series switches.</p>
            <br />
            <h4>Hi-Tek 725</h4>
            <p>15.621 x 15.621 mm (0.615 in)</p>
            <p>For NMB Hi-Tek 725 switches.</p>
            <br />
            <h4>i-Rocks</h4>
            <p>15.8 x 13.4 mm</p>
            <p>For i-Rocks mechanical switches.</p>
            <br />
            <h4>Futaba MA</h4>
            <p>14 x 15 mm</p>
            <p>For Futaba MA mechanical switches.</p>
            
        </div>
    )
}

export function OtherCutoutPane() {

    return (
        <div>
            <h2>Stabilizer Cutout Types</h2>
            <br />
            <h4>Cherry MX Basic</h4>
            <p>A typical cutout suited for most occasions.</p>
            <br />
            <h4>Cherry MX Tight Fit</h4>
            <p>A smaller cutout that fits tightly around Cherry MX spec stabilizers.<br />
                May not fit with oversized third party stabilizers.</p>
            <br />
            <h4>Cherry MX Spec</h4>
            <p>The exact stabilizer cutout specified by Cherry MX datasheets.<br />
                Fillet radius should be either very small or 0 due to its intricate shape and tight fit.</p>
            <br />
            <h4>Alps AEK</h4>
            <p>Alps-specific stabilizers for AEK stabilizer sizes.</p>
            <br />
            <h4>Alps AT101</h4>
            <p>Alps-specific stabilizers for AT101 stabilizer sizes.</p>
            <br />
            <h2>Acoustic Cutout Types</h2>
            <br />
            <h4>Cherry MX Basic</h4>
            <p>A modest amount of acoustic cuts.</p>
            <br />
            <h4>Cherry MX Extreme</h4>
            <p>A larger amount of acoustic cuts.</p>
        </div>
    )
}

export function AdvancedPane() {

    return (
        <div>
            <h2>Advanced Tuning</h2>
            <br />
            <h4>Unit Size</h4>
            <p>What 1U equivalates to in millimeters. <br />
                Standard is 19.05mm, but certain switches such as Choc may need different spacing.</p>
            <br />
            <h4>Kerf</h4>
            <p>Offset to account for manufacturing margins. Useful for laser cutting and similar.<br />
                Positive values yield smaller cutouts.</p>
        </div>
    )
}

export function RegistrationHelpPane() {

    return (
        <div>
            <h2>Registration marks</h2>
            <p>
                <strong>Removed.</strong> All geometry is exported in a single multi-layer file with a shared origin,
                so a separate alignment cross on a <code>CONSTRUCTION</code> layer is no longer generated.
            </p>
            <p>
                Layers (Top-* and Link-*) line up as drawn. Use CAD layer visibility to work on each part.
            </p>
        </div>
    )
}

export function CompanionPane() {

    return (
        <div>
            <h2>KLE CAD</h2>
            <p>
                Draw the keyboard and plate-outline corners in
                {' '}<strong>KLE CAD</strong>, then paste the raw data into this page.
                This site turns that into switch plates and stamp layers for 3D-printed hotswap builds.
            </p>
            <p>
                Official keyboard-layout-editor.com will not accept the CAD zone fields
                {' '}(<code>_z</code>, <code>_zi</code>, <code>_zones</code>).
                Without those fields a layout should still load there, but this pair is meant to work together.
            </p>
            <div className="cad-companion">
                <a href="https://avaviel.github.io/keyboard-layout-editor-CAD/" target="_blank" rel="noopener noreferrer">KLE CAD</a>
                <span className="arrow" aria-hidden="true">→</span>
                <a className="here" href="https://avaviel.github.io/YAKB-cad-helper-addons/" target="_blank" rel="noopener noreferrer">This site</a>
                <span className="arrow" aria-hidden="true">→</span>
                <a href="https://github.com/Avaviel/YAKB-cad-helper-addons" target="_blank" rel="noopener noreferrer">Source</a>
                <span className="arrow" aria-hidden="true">→</span>
                <a href="https://github.com/Avaviel/keyboard-layout-editor-CAD" target="_blank" rel="noopener noreferrer">KLE CAD source</a>
            </div>
        </div>
    )
}

export function AboutPane() {

    return (
        <div>
            <h2>YAKB CAD Helper</h2>
            <p>
                This site is a <strong>fork / extension</strong> of ai03’s open-source
                {' '}<a href="https://github.com/ai03-2725/yet-another-keyboard-builder">plate generator (YAKB)</a>.
                The upstream project is an exceptionally accurate, client-side keyboard plate generator
                (KLE layout in → DXF/SVG out).
            </p>
            <p>
                <strong>What we add here:</strong> extra tooling aimed at people making
                {' '}<strong>3D-printed custom keyboards</strong> with <strong>hotswap sockets</strong> —
                stamp layers (MX hotswap fits, back cut, hole cuts, switchplace extrude), registration marks
                for multi-layer alignment, and a workflow focused on printed builds.
                MX is supported now; <strong>Kailh Choc</strong> support is planned.
            </p>
            <br />
            <h4>Open source &amp; license</h4>
            <p>
                Upstream YAKB is free/open-source software under the
                {' '}<strong>GNU Affero General Public License v3 (AGPL-3.0)</strong>.
                That license already allows anyone to use, study, modify, and redistribute the software —
                including building extensions like this — without asking the original author for special permission,
                as long as you follow the license (keep it open source under AGPL, provide source when you distribute
                or run a modified network service, and preserve copyright notices).
            </p>
            <p>
                In short: forking and adding features for custom/3D-printed keyboard workflows is allowed by the license;
                you do not need a private “OK” from the author, but you do need to honor AGPL terms.
            </p>
            <br />
            <h4>Upstream project</h4>
            <p>
                Originally written in Python as a CLI and server-side tool; rewritten as a client-side web app
                to provide a production-tested, accurate, versatile plate generator for keyboard makers.
            </p>
            <br />
            <h4>Credits (upstream contributors)</h4>
            <p>The following people have contributed help and/or information for making the original project possible.</p>
            <p>
                huygn<br />
                jrhe<br />
                fcoury<br />
                Amtra5<br />
                Mxblue<br />
                Bakingpy<br />
                Senter<br />
                Pwner<br />
                Kevinplus
            </p>
            <br />
            <h4>Links</h4>
            <p>
                This site:{' '}
                <a href="https://avaviel.github.io/YAKB-cad-helper-addons/" target="_blank" rel="noreferrer">avaviel.github.io/YAKB-cad-helper-addons</a>
                <br />
                This source:{' '}
                <a href="https://github.com/Avaviel/YAKB-cad-helper-addons" target="_blank" rel="noreferrer">Avaviel/YAKB-cad-helper-addons</a>
                <br />
                Companion layout editor:{' '}
                <a href="https://avaviel.github.io/keyboard-layout-editor-CAD/" target="_blank" rel="noreferrer">KLE CAD</a>
                {' '}
                (<a href="https://github.com/Avaviel/keyboard-layout-editor-CAD" target="_blank" rel="noreferrer">source</a>)
                <br />
                Upstream plategen:{' '}
                <a href="https://github.com/ai03-2725/yet-another-keyboard-builder" target="_blank" rel="noreferrer">ai03-2725/yet-another-keyboard-builder</a>
            </p>
        </div>
    )
}









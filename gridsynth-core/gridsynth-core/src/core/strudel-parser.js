// src/core/strudel-parser.js
// Lightweight Strudel / TidalCycles Mini-Notation Parser for GridSynth

export const NOTE_SEMITONES = {
    'c': 0, 'c#': 1, 'db': 1,
    'd': 2, 'd#': 3, 'eb': 3,
    'e': 4,
    'f': 5, 'f#': 6, 'gb': 6,
    'g': 7, 'g#': 8, 'ab': 8,
    'a': 9, 'a#': 10, 'bb': 10,
    'b': 11
};

/**
 * Converts a note string (e.g. "c2", "eb3", "f#4", "0.5") to 1V/Oct CV voltage.
 * Calibration: 0V = C1 (32.7Hz), 1V = C2, 2V = C3, 3V = C4 (261.6Hz), etc.
 */
export function noteToCv(str) {
    if (typeof str === 'number') return str;
    const s = String(str).trim().toLowerCase();
    
    // Check if it's already a direct floating point voltage number (e.g. "0.25")
    if (!isNaN(parseFloat(s)) && !/[a-g]/i.test(s)) {
        return parseFloat(s);
    }

    const match = s.match(/^([a-g][#b]?)(-?\d+)?$/);
    if (!match) return 0.0;

    const noteName = match[1];
    const oct = match[2] !== undefined ? parseInt(match[2], 10) : 2; // Default to octave 2
    const semi = NOTE_SEMITONES[noteName] ?? 0;

    // 0V = C1 (octave 1, semi 0)
    return Math.max(0, (oct - 1) + semi / 12.0);
}

/**
 * Generates Bjorklund Euclidean rhythm of k pulses over n steps.
 * e.g. euclidean(3, 8) -> [true, false, false, true, false, false, true, false]
 */
export function euclidean(k, n) {
    k = Math.max(0, Math.min(k, n));
    if (k <= 0) return Array(n).fill(false);
    if (k >= n) return Array(n).fill(true);

    let pattern = [];
    for (let i = 0; i < n; i++) {
        pattern.push(i < k ? [1] : [0]);
    }

    while (true) {
        let ones = [], zeros = [];
        for (let item of pattern) {
            if (item[item.length - 1] === 1) ones.push(item);
            else zeros.push(item);
        }
        if (zeros.length <= 1 || ones.length === 0) break;
        let count = Math.min(ones.length, zeros.length);
        let newPat = [];
        for (let i = 0; i < count; i++) {
            newPat.push(ones[i].concat(zeros[i]));
        }
        for (let i = count; i < ones.length; i++) newPat.push(ones[i]);
        for (let i = count; i < zeros.length; i++) newPat.push(zeros[i]);
        pattern = newPat;
    }

    return pattern.flat().map(v => v === 1);
}

/**
 * Splits a mini-notation string by top-level spaces, respecting brackets [...] and parentheses (...).
 */
function splitTopLevelTokens(str) {
    const tokens = [];
    let cur = '';
    let bracketDepth = 0;
    let parenDepth = 0;
    let angleDepth = 0;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '[') bracketDepth++;
        else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
        else if (char === '(') parenDepth++;
        else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
        else if (char === '<') angleDepth++;
        else if (char === '>') angleDepth = Math.max(0, angleDepth - 1);

        if (/\s/.test(char) && bracketDepth === 0 && parenDepth === 0 && angleDepth === 0) {
            if (cur.trim()) tokens.push(cur.trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    if (cur.trim()) tokens.push(cur.trim());

    // Expand replication operator (!N, e.g. "c2!3" -> "c2 c2 c2", "[c2 eb2]!2" -> "[c2 eb2] [c2 eb2]")
    const expanded = [];
    tokens.forEach(tok => {
        const repMatch = tok.match(/^(.*?)!(\d+)$/);
        if (repMatch) {
            const base = repMatch[1].trim();
            const count = Math.max(1, Math.min(32, parseInt(repMatch[2], 10)));
            for (let k = 0; k < count; k++) {
                expanded.push(base);
            }
        } else {
            expanded.push(tok);
        }
    });

    return expanded;
}

/**
 * Counts the total number of leaf tokens within a token tree.
 */
function countLeafTokens(tokens) {
    let count = 0;
    tokens.forEach(rawToken => {
        let token = rawToken.trim();
        if (!token) return;
        if (token.startsWith('<') && token.endsWith('>')) {
            count += countLeafTokens(splitTopLevelTokens(token.slice(1, -1).trim()));
            return;
        }
        const multMatch = token.match(/^(.*?)\*(\d+)$/);
        if (multMatch) {
            const num = Math.max(1, Math.min(32, parseInt(multMatch[2], 10)));
            count += countLeafTokens([multMatch[1].trim()]) * num;
            return;
        }
        const eucMatch = token.match(/^(.*?)\((\d+)\s*,\s*(\d+)\)$/);
        if (eucMatch) {
            count += Math.max(1, Math.min(32, parseInt(eucMatch[3], 10)));
            return;
        }
        if (token.startsWith('[') && token.endsWith(']')) {
            const inner = token.slice(1, -1).trim();
            const layers = inner.includes(',') ? inner.split(',')[0].trim() : inner;
            count += countLeafTokens(splitTopLevelTokens(layers));
            return;
        }
        count++;
    });
    return count;
}

/**
 * Recursive parser generating a list of leaf events with normalized time ranges [start, end) within [0, 1).
 */
function parseTokensRecursive(tokens, start, end, cycleIndex = 0, counter = { val: 0 }) {
    if (!tokens || tokens.length === 0) return [];
    const dur = end - start;
    const stepDur = dur / tokens.length;
    let events = [];

    tokens.forEach((rawToken, idx) => {
        const tStart = start + idx * stepDur;
        const tEnd = tStart + stepDur;
        let token = rawToken.trim();

        // 1. Alternations: <a b c>
        if (token.startsWith('<') && token.endsWith('>')) {
            const inner = token.slice(1, -1).trim();
            const altTokens = splitTopLevelTokens(inner);
            if (altTokens.length > 0) {
                const selIdx = Math.abs(cycleIndex) % altTokens.length;
                altTokens.forEach((st, sIdx) => {
                    if (sIdx === selIdx) {
                        events = events.concat(parseTokensRecursive([st], tStart, tEnd, cycleIndex, counter));
                    } else {
                        counter.val += countLeafTokens([st]);
                    }
                });
            }
            return;
        }

        // 2. Multiplication: token*N or [inner]*N
        const multMatch = token.match(/^(.*?)\*(\d+)$/);
        if (multMatch) {
            const base = multMatch[1].trim();
            const count = Math.max(1, Math.min(32, parseInt(multMatch[2], 10)));
            const subTokens = Array(count).fill(base);
            events = events.concat(parseTokensRecursive(subTokens, tStart, tEnd, cycleIndex, counter));
            return;
        }

        // 3. Euclidean: token(k,n) or [inner](k,n)
        const eucMatch = token.match(/^(.*?)\((\d+)\s*,\s*(\d+)\)$/);
        if (eucMatch) {
            const base = eucMatch[1].trim() || 'c2';
            const k = parseInt(eucMatch[2], 10);
            const n = Math.max(1, Math.min(32, parseInt(eucMatch[3], 10)));
            const eucBits = euclidean(k, n);
            const subTokens = eucBits.map(hit => hit ? base : '~');
            events = events.concat(parseTokensRecursive(subTokens, tStart, tEnd, cycleIndex, counter));
            return;
        }

        // 4. Sub-divisions: [a b c]
        if (token.startsWith('[') && token.endsWith(']')) {
            const inner = token.slice(1, -1).trim();
            if (inner.includes(',')) {
                const layers = inner.split(',').map(s => s.trim()).filter(Boolean);
                const subTokens = splitTopLevelTokens(layers[0]);
                events = events.concat(parseTokensRecursive(subTokens, tStart, tEnd, cycleIndex, counter));
            } else {
                const subTokens = splitTopLevelTokens(inner);
                events = events.concat(parseTokensRecursive(subTokens, tStart, tEnd, cycleIndex, counter));
            }
            return;
        }

        // 5. Leaf token (Note, Rest, Probability)
        let prob = 1.0;
        const probMatch = token.match(/^(.*?)\?([0-9.]+)?$/);
        if (probMatch) {
            token = probMatch[1].trim();
            prob = probMatch[2] !== undefined ? parseFloat(probMatch[2]) : 0.5;
        }

        const tokId = counter.val++;
        const isRest = token === '~' || token === '-' || token === '_' || token === '';
        events.push({
            start: tStart,
            end: tEnd,
            cv: isRest ? 0.0 : noteToCv(token),
            gate: !isRest,
            isRest,
            prob: isNaN(prob) ? 1.0 : Math.max(0, Math.min(1.0, prob)),
            label: isRest ? '~' : token.toUpperCase(),
            tokenIdx: tokId
        });
    });

    return events;
}

/**
 * Main parser entry point: parses a Strudel pattern string into timed events for a specific cycle.
 */
export function parseStrudelPattern(patternStr, cycleBeats = 4, cycleIndex = 0) {
    if (!patternStr || !patternStr.trim()) {
        patternStr = 'c2 c2 c2 c2';
    }
    const clean = patternStr.replace(/[\u3000]/g, ' ').trim();
    const tokens = splitTopLevelTokens(clean);
    const events = parseTokensRecursive(tokens, 0.0, 1.0, cycleIndex, { val: 0 });
    return events.length > 0 ? events : [{ start: 0, end: 1, cv: 1.0, gate: true, isRest: false, prob: 1.0, label: 'C2', tokenIdx: 0 }];
}

/**
 * Pre-computes a multi-cycle event table for smooth cyclic alternations <a b c>.
 */
export function parseStrudelPatternCycles(patternStr, cycleBeats = 4, maxCycles = 16) {
    if (!patternStr || !patternStr.trim()) {
        patternStr = 'c2 c2 c2 c2';
    }
    const sanitized = patternStr.replace(/[\u3000]/g, ' ');
    const cycles = [];
    for (let c = 0; c < maxCycles; c++) {
        cycles.push(parseStrudelPattern(sanitized, cycleBeats, c));
    }
    return cycles;
}

/**
 * Built-in Strudel Presets (8 Selected House & Percussion Grooves)
 */
export const STRUDEL_PRESETS = [
    // --- House Basslines ---
    { name: 'Classic 90s Offbeat', pattern: '[~ c2] [~ c2] [~ c2] [~ <c2 eb2>]', desc: '90s王道の裏打ちハウス・ベースライン' },
    { name: '16-Step Octaves', pattern: '[c2 c2 c2 c2] [c2 c2 c2 c3] [c2 c2 c2 c2] [c2 c2 c2 c4]', desc: '4拍×4ステップのオクターブ跳躍ベース' },
    { name: 'Deep House Sync', pattern: 'c2 [~ c2] ~ [c2 <eb2 g2>] [~ c2] ~ [c2 <bb1 d2>]', desc: 'シンコペーションと周回展開のディープハウス' },
    { name: 'Chicago Jackin', pattern: '[c2 c2] ~ [c2 eb2] [~ c2] [c2 <g2 bb2>] ~ [eb2 c2] <~ c2>', desc: '16分の跳ねとドライブ感のあるシカゴスタイル' },
    { name: 'Garage / 2-Step', pattern: 'c2 ~ [~ c2] ~ ~ [c2 <f2 eb2>] ~ [c2*2]', desc: '独特の間（スペース）を活かしたガラージ・サブベース' },

    // --- Percussion & Drums ---
    { name: '909 Hats & Ride', pattern: '[~ c4] [c4*2 c4] [~ c4] [c4 <c4*2 c4*3>]', desc: '裏打ちオープンハットとゴースト連打' },
    { name: 'House Shaker', pattern: '[c4 c4*2] [c4 ~] [c4*2 c4] [<c4 d4> c4]', desc: 'グルーヴをドライブさせるシェイカー・パーカッション' },
    { name: 'Syncopated Clap', pattern: '~ [c3 ~] ~ [c3 <~ c3*2>]', desc: '2・4拍バックビートと変則ゴーストショット' }
];

/**
 * Generates an HTML string representation of the pattern with data-pat-tok="N" attributes
 * matching the event indices generated by parseStrudelPattern for real-time highlighting.
 */
export function renderPatternHighlightedHTML(patternStr) {
    if (!patternStr || !patternStr.trim()) patternStr = 'c2 c2 c2 c2';
    const cleanStr = patternStr.replace(/[\u3000]/g, ' ');
    let eventCounter = 0;

    function renderTokens(tokens) {
        return tokens.map(rawToken => {
            let token = rawToken.trim();
            if (!token) return '';

            // Alternations: <a b c>
            if (token.startsWith('<') && token.endsWith('>')) {
                const inner = token.slice(1, -1).trim();
                const subTokens = splitTopLevelTokens(inner);
                const renderedSub = renderTokens(subTokens);
                return `<span class="inline-flex items-center gap-0.5"><span class="text-purple-400 font-bold">&lt;</span>${renderedSub}<span class="text-purple-400 font-bold">&gt;</span></span>`;
            }

            // Multiplication: token*N
            const multMatch = token.match(/^(.*?)\*(\d+)$/);
            if (multMatch) {
                const base = multMatch[1].trim();
                const count = Math.max(1, Math.min(32, parseInt(multMatch[2], 10)));
                const renderedSub = Array.from({ length: count }, () => renderTokens([base])).join(' ');
                return `<span class="inline-flex items-center gap-0.5">${renderedSub}<span class="text-amber-400/90 font-mono text-[8px] font-bold ml-0.5">*${count}</span></span>`;
            }

            // Euclidean: token(k,n)
            const eucMatch = token.match(/^(.*?)\((\d+)\s*,\s*(\d+)\)$/);
            if (eucMatch) {
                const base = eucMatch[1].trim() || 'c2';
                const k = parseInt(eucMatch[2], 10);
                const n = Math.max(1, Math.min(32, parseInt(eucMatch[3], 10)));
                const eucBits = euclidean(k, n);
                const renderedSub = eucBits.map(hit => {
                    const id = eventCounter++;
                    if (hit) {
                        return `<span data-pat-tok="${id}" class="pat-tok text-cyan-300 font-mono font-bold">${base}</span>`;
                    } else {
                        return `<span data-pat-tok="${id}" class="pat-tok text-cyan-400/40 font-mono">~</span>`;
                    }
                }).join(' ');
                return `<span class="inline-flex items-center gap-0.5"><span class="text-cyan-400/60 font-bold">[</span>${renderedSub}<span class="text-amber-400/90 font-mono text-[7.5px] font-bold ml-0.5">(${k},${n})</span><span class="text-cyan-400/60 font-bold">]</span></span>`;
            }

            // Sub-divisions: [a b c]
            if (token.startsWith('[') && token.endsWith(']')) {
                const inner = token.slice(1, -1).trim();
                if (inner.includes(',')) {
                    const layers = inner.split(',').map(s => s.trim()).filter(Boolean);
                    const subTokens = splitTopLevelTokens(layers[0]);
                    return `<span class="text-cyan-400/60 font-bold">[</span>${renderTokens(subTokens)}<span class="text-cyan-400/60 font-bold">]</span>`;
                } else {
                    const subTokens = splitTopLevelTokens(inner);
                    return `<span class="text-cyan-400/60 font-bold">[</span>${renderTokens(subTokens)}<span class="text-cyan-400/60 font-bold">]</span>`;
                }
            }

            // Leaf token (Note, Rest, Prob)
            const id = eventCounter++;
            let probStr = '';
            const probMatch = token.match(/^(.*?)\?([0-9.]+)?$/);
            if (probMatch) {
                token = probMatch[1].trim();
                probStr = `?${probMatch[2] ?? ''}`;
            }

            const isRest = token === '~' || token === '-' || token === '_' || token === '';
            const textCls = isRest ? 'text-cyan-400/40 font-mono' : 'text-cyan-300 font-mono font-bold';

            return `<span data-pat-tok="${id}" class="pat-tok ${textCls}">${token}${probStr ? `<span class="text-amber-400/80 text-[7.5px]">${probStr}</span>` : ''}</span>`;
        }).join(' ');
    }

    const tokens = splitTopLevelTokens(cleanStr.trim());
    return renderTokens(tokens);
}


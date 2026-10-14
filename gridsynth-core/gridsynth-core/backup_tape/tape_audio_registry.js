// [BACKUP] AUDIO_REGISTRY.TAPE implementation
// Originally in src/audio/registry.js

export const TAPE_AUDIO_ENTRY = {
    create: (ctx, d, patch, eng) => {
        const w = new AudioWorkletNode(ctx, 'tape-processor', {
            numberOfInputs: 4,
            numberOfOutputs: 2,
            outputChannelCount: [1, 1]
        });

        const gTrig = ctx.createGain();
        gTrig.connect(w, 0, 0);

        const gStart = ctx.createGain();
        gStart.connect(w, 0, 1);

        const gLen = ctx.createGain();
        gLen.connect(w, 0, 2);

        const gSpeed = ctx.createGain();
        gSpeed.connect(w, 0, 3);

        const outWave = ctx.createGain();
        w.connect(outWave, 0);

        const outGate = ctx.createGain();
        w.connect(outGate, 1);

        if (eng?.silentSink) {
            outGate.connect(eng.silentSink);
        }

        const inst = {
            nodes: { w, gTrig, gStart, gLen, gSpeed, outWave, outGate },
            inputs: {
                trig_in: gTrig,
                start_cv: gStart,
                len_cv: gLen,
                speed_cv: gSpeed
            },
            outputs: {
                wave_out: outWave,
                gate_out: outGate
            },
            _isPlaying: false,
            _playPos: 0.0,
            _bufferData: null,
            read: () => ({ isPlaying: inst._isPlaying, pos: inst._playPos, buffer: inst._bufferData })
        };

        w.port.onmessage = e => {
            if (e.data.type === 'PLAY_STATUS') {
                inst._isPlaying = e.data.isPlaying;
                inst._playPos = e.data.pos;
            }
        };

        // バッファロード処理
        const cachedBuf = (typeof window !== 'undefined' && window.TAPE_BUFFER_CACHE?.get(d.id)) || d._bufferData;
        if (cachedBuf) {
            inst._bufferData = cachedBuf;
            w.port.postMessage({ type: 'SET_BUFFER', buffer: cachedBuf });
        } else if (d.url) {
            inst._lastLoadedUrl = d.url;
            AudioHelpers.loadAudioBufferFromUrl(ctx, d.url).then(buf => {
                inst._bufferData = buf;
                if (typeof window !== 'undefined' && window.TAPE_BUFFER_CACHE) {
                    window.TAPE_BUFFER_CACHE.set(d.id, buf);
                }
                w.port.postMessage({ type: 'SET_BUFFER', buffer: buf });
            }).catch(err => {
                console.warn('[TAPE] URL load failed, fallback to procedural perc:', err);
                const defBuf = AudioHelpers.generateDefaultPercussionBuffer(ctx.sampleRate);
                inst._bufferData = defBuf;
                if (typeof window !== 'undefined' && window.TAPE_BUFFER_CACHE) {
                    window.TAPE_BUFFER_CACHE.set(d.id, defBuf);
                }
                w.port.postMessage({ type: 'SET_BUFFER', buffer: defBuf });
            });
        } else {
            const defBuf = AudioHelpers.generateDefaultPercussionBuffer(ctx.sampleRate);
            inst._bufferData = defBuf;
            if (typeof window !== 'undefined' && window.TAPE_BUFFER_CACHE) {
                window.TAPE_BUFFER_CACHE.set(d.id, defBuf);
            }
            w.port.postMessage({ type: 'SET_BUFFER', buffer: defBuf });
        }

        w.port.postMessage({
            type: 'SET_PARAMS',
            start: d.start ?? 0.0,
            end: d.end !== undefined ? d.end : ((d.start ?? 0.0) + (d.length ?? 1.0)),
            length: d.length ?? 1.0,
            speed: d.speed ?? 1.0,
            loop: !!d.loop
        });

        return inst;
    },
    update: (ctx, inst, d, patch, eng) => {
        const cachedBuf = (typeof window !== 'undefined' && window.TAPE_BUFFER_CACHE?.get(d.id)) || d._bufferData;
        if (cachedBuf && inst._bufferData !== cachedBuf) {
            inst._bufferData = cachedBuf;
            inst.nodes.w?.port.postMessage({ type: 'SET_BUFFER', buffer: cachedBuf });
        } else if (d.url && inst._lastLoadedUrl !== d.url) {
            inst._lastLoadedUrl = d.url;
            AudioHelpers.loadAudioBufferFromUrl(ctx, d.url).then(buf => {
                inst._bufferData = buf;
                if (typeof window !== 'undefined' && window.TAPE_BUFFER_CACHE) {
                    window.TAPE_BUFFER_CACHE.set(d.id, buf);
                }
                inst.nodes.w.port.postMessage({ type: 'SET_BUFFER', buffer: buf });
            }).catch(err => {
                console.warn('[TAPE] URL load failed on update:', err);
            });
        }
        inst.nodes.w?.port.postMessage({
            type: 'SET_PARAMS',
            start: d.start ?? 0.0,
            end: d.end !== undefined ? d.end : ((d.start ?? 0.0) + (d.length ?? 1.0)),
            length: d.length ?? 1.0,
            speed: d.speed ?? 1.0,
            loop: !!d.loop
        });
    }
};


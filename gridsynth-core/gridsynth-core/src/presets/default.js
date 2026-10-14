import { preset01 } from './demos/01_delay_techno.js';
import { preset02 } from './demos/02_keyboard_lead.js';
import { preset03 } from './demos/03_wavefold_verb.js';
import { preset04 } from './demos/04_random_sh_delay.js';
import { preset05 } from './demos/05_subpatch_multi_groove.js';
import { preset06 } from './demos/06_strudel_house_bassline.js';
import { preset07 } from './demos/07_dub_techno_deep_space.js';
import { preset08 } from './demos/08_markov_generative_chains.js';
import { preset09 } from './demos/09_fm_heavy_techno_groove.js';
import { preset10 } from './demos/10_fm_simple_test.js';
import { preset11 } from './demos/11_fmcore_2op_demo.js';

export const getDefaultPresets = () => ({
    '01_DELAY_TECHNO': preset01,
    '02_KEYBOARD_LEAD': preset02,
    '03_WAVEFOLD_VERB': preset03,
    '04_RANDOM_SH_DELAY': preset04,
    '05_SUBPATCH_MULTI_GROOVE': preset05,
    '06_STRUDEL_HOUSE_BASSLINE': preset06,
    '07_DUB_TECHNO_DEEP_SPACE': preset07,
    '08_MARKOV_GENERATIVE_CHAINS': preset08,
    '09_FM_HEAVY_TECHNO': preset09,
    '10_FM_SIMPLE_TEST': preset10,
    '11_FMCORE_2OP_DEMO': preset11
});

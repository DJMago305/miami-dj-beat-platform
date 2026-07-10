import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./mdj-alias-loader.mjs', pathToFileURL('./scripts/'));

import ora from 'ora';
import { lifecycle } from './lifecycle.js';

export function spinner(text: string) {
    lifecycle.check();
    const result = ora(text).start();
    lifecycle.own(() => result.stop());
    return result;
}

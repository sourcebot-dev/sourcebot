import readline from 'readline-sync';

export const confirmAction = (message: string = "Are you sure you want to proceed? [N/y]") => {
    const response = readline.question(message).toLowerCase();
    if (response !== 'y') {
        console.log("Aborted.");
        process.exit(0);
    }
}

export const abort = () => {
    console.log("Aborted.");
    process.exit(0);
};

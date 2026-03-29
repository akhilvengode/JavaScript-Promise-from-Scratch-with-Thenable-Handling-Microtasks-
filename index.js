const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

const STATUS = new WeakMap();
const VALUE = new WeakMap();
const CBS = new WeakMap();

function MyPromise(executor) {
    STATUS.set(this, PENDING);
    VALUE.set(this, undefined);
    CBS.set(this, []);

    const handleCallbacks = () => {
        const callbacks = CBS.get(this);
        CBS.set(this, []);
        queueMicrotask(() => {
            callbacks.forEach((handler) => {
                handle.call(this, handler);
            });
        });
    };

    const resolve = value => {
        try {
            const status = STATUS.get(this);
            if (status !== PENDING) return;

            if (value === this) {
                throw new TypeError('Chaining cycle detected for promise');
            }

            // handling thenables
            const then = value?.then;
            if (typeof then === 'function') {
                let called = false;
                try {
                    then.call(
                        value,
                        val => {
                            if (called) return;
                            called = true;
                            resolve(val);
                        },
                        err => {
                            if (called) return;
                            called = true;
                            reject(err);
                        }
                    );
                } catch (error) {
                    if (!called) {
                        reject(error);
                    }
                }

            } else {
                STATUS.set(this, FULFILLED);
                VALUE.set(this, value);

                handleCallbacks();
            }
        } catch (error) {
            reject(error);
        }
    };

    const reject = reason => {
        const status = STATUS.get(this);
        if (status !== PENDING) return;

        STATUS.set(this, REJECTED);
        VALUE.set(this, reason);

        handleCallbacks();
    };

    let called = false;
    try {
        const updatedResolve = value => {
            if (called) return;
            called = true;
            resolve(value);
        };

        const updatedReject = reason => {
            if (called) return;
            called = true;
            reject(reason);
        };
        executor(updatedResolve, updatedReject);
    } catch (error) {
        if (!called) {
            reject(error);
        }
    }
}

function handle({ onFulfilled, onRejected, resolve, reject }) {
    const status = STATUS.get(this);
    const value = VALUE.get(this);

    try {
        if (status === FULFILLED) {
            resolve(onFulfilled ? onFulfilled(value) : value);
        } else {
            if (onRejected) {
                resolve(onRejected(value));
            } else {
                reject(value);
            }
        }
    } catch (error) {
        reject(error);
    }
}

MyPromise.resolve = function (value) {
    return new MyPromise(resolve => {
        resolve(value);
    });
};

MyPromise.reject = function (reason) {
    return new MyPromise((_, reject) => {
        reject(reason);
    });
};

MyPromise.prototype.then = function (onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
        const status = STATUS.get(this);
        const handler = { onFulfilled, onRejected, resolve, reject };

        if (status === PENDING) {
            CBS.get(this).push(handler);
        } else {
            queueMicrotask(() => {
                handle.call(this, handler);
            });
        }
    });
};

MyPromise.prototype.catch = function (onRejected) {
    return this.then(undefined, onRejected);
};

MyPromise.prototype.finally = function (callback = () => {}) {
    return this.then(
        val => MyPromise.resolve(callback()).then(() => val),
        reason => MyPromise.resolve(callback()).then(() => { throw reason; })
    );
};

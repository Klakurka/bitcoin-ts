/* eslint-disable functional/no-expression-statement, @typescript-eslint/no-magic-numbers, functional/immutable-data */
import test from 'ava';

import {
  AuthenticationInstruction,
  createAuthenticationVirtualMachine,
  InstructionSet,
  MinimumProgramState,
  StackState
} from '../lib';

enum simpleOps {
  OP_0 = 0,
  OP_INCREMENT = 1,
  OP_DECREMENT = 2,
  OP_ADD = 3
}

enum SimpleError {
  UNDEFINED = 'The program called an undefined opcode.',
  EMPTY_STACK = 'The program tried to pop from an empty stack.'
}

interface SimpleProgram {
  instructions: readonly AuthenticationInstruction<simpleOps>[];
}

interface SimpleProgramState extends MinimumProgramState, StackState<number> {
  error?: SimpleError;
}

const simpleInstructionSet: InstructionSet<
  SimpleProgram,
  SimpleProgramState
> = {
  clone: state => ({
    ...(state.error === undefined ? {} : { error: state.error }),
    instructions: state.instructions.slice(),
    ip: state.ip,
    stack: state.stack.slice()
  }),
  continue: state =>
    state.error === undefined && state.ip < state.instructions.length,
  evaluate: (program, stateEvaluate) => {
    const internalState = { ip: 0, stack: [] };
    return stateEvaluate({ ...internalState, ...program });
  },
  operations: {
    [simpleOps.OP_0]: state => {
      state.stack.push(0);
      return state;
    },
    [simpleOps.OP_INCREMENT]: state => {
      const top = state.stack.pop();
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      top === undefined
        ? (state.error = SimpleError.EMPTY_STACK)
        : state.stack.push(top + 1);
      return state;
    },
    [simpleOps.OP_DECREMENT]: state => {
      const top = state.stack.pop();
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      top === undefined
        ? (state.error = SimpleError.EMPTY_STACK)
        : state.stack.push(top - 1);
      return state;
    },
    [simpleOps.OP_ADD]: state => {
      const a = state.stack.pop();
      const b = state.stack.pop();
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      a === undefined || b === undefined
        ? (state.error = SimpleError.EMPTY_STACK)
        : state.stack.push(a + b);
      return state;
    }
  },
  undefined: state => {
    state.error = SimpleError.UNDEFINED;
    return state;
  },
  verify: state => state.stack[state.stack.length - 1] === 1
};

const vm = createAuthenticationVirtualMachine(simpleInstructionSet);

const instructions: readonly AuthenticationInstruction<simpleOps>[] = [
  { opcode: simpleOps.OP_0 },
  { opcode: simpleOps.OP_INCREMENT },
  { opcode: simpleOps.OP_INCREMENT },
  { opcode: simpleOps.OP_0 },
  { opcode: simpleOps.OP_DECREMENT },
  { opcode: simpleOps.OP_ADD }
];

test('vm.evaluate with a simple instruction set', t => {
  t.deepEqual(vm.evaluate({ instructions }), {
    instructions,
    ip: 6,
    stack: [1]
  });
});

test('vm.debug with a simple instruction set', t => {
  t.deepEqual(vm.debug({ instructions }), [
    { instructions, ip: 1, stack: [0] },
    { instructions, ip: 2, stack: [1] },
    { instructions, ip: 3, stack: [2] },
    { instructions, ip: 4, stack: [2, 0] },
    { instructions, ip: 5, stack: [2, -1] },
    { instructions, ip: 6, stack: [1] },
    { instructions, ip: 6, stack: [1] }
  ]);
});

test('vm.stateDebug with a simple instruction set', t => {
  t.deepEqual(vm.stateDebug({ instructions, ip: 0, stack: [] }), [
    { instructions, ip: 1, stack: [0] },
    { instructions, ip: 2, stack: [1] },
    { instructions, ip: 3, stack: [2] },
    { instructions, ip: 4, stack: [2, 0] },
    { instructions, ip: 5, stack: [2, -1] },
    { instructions, ip: 6, stack: [1] }
  ]);
});

test('vm.stateEvaluate does not mutate the original state', t => {
  const unchanged = { instructions, ip: 0, stack: [] };
  t.deepEqual(vm.stateEvaluate(unchanged), { instructions, ip: 6, stack: [1] });
  t.deepEqual(unchanged, { instructions, ip: 0, stack: [] });
});

test('vm.stateStep does not mutate the original state', t => {
  const unchanged = { instructions, ip: 5, stack: [2, -1] };
  t.deepEqual(vm.stateStep(unchanged), { instructions, ip: 6, stack: [1] });
  t.deepEqual(unchanged, { instructions, ip: 5, stack: [2, -1] });
});

test('vm.stateStepMutate does not clone (mutating the original state)', t => {
  const changed = { instructions, ip: 5, stack: [2, -1] };
  t.deepEqual(vm.stateStepMutate(changed), { instructions, ip: 6, stack: [1] });
  t.deepEqual(changed, { instructions, ip: 6, stack: [1] });
});

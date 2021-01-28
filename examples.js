const runExample = (example, title) => {
  console.log(`%c< ${ title } >`, 'color: #0095ff');
  example();
  console.log('\n');
};

const calcFullName = (state, current) => {
  if ('name' in state || 'family' in state)
    return `${ state.name || current.name } ${ state.family || current.family }`;
  return current.fullName;
};

class CustomModel extends SonexModel {
  constructor(state) {
    const calculateProps = {
      fullName: calcFullName
    };
    super(state, calculateProps);
  }

  getFullName() {
    return this.fullName;
  }
  getSubscribers() {
    return this.subscribers;
  }
};

const model = new CustomModel({ name: 'Nikolay', family: 'Yanovskiy', subscribers: '45' });

/** Example 1. Hook events. */
const exampleHookEvents = () => {
  const hook = (newValues, changesProps) => {
    console.log({ newValues, changesProps });
  };

  model.useEvent(hook, 'set');
  model.family = 'Gogol';
  model.family = 'Gogol';
  model.unUseEvent(hook, 'set');
};


/** Example 2. Handle before method call (change props). */
const exampleHookBefore = () => {
  const hook = (newState, current) => {
    if ('name' in newState) {
      const { name } = newState;
      const changedName = name[0].toUpperCase() + name.substring(1);
      return [{ ...newState, name: changedName }, current];
    }
    return [state, changes];
  };
  model.useProps(hook, 'set');

  model.name = 'anton';
  console.log("Set 'anton' but saved as 'Anton' ");
  console.log({ state: model.toObject() });
  model.unUseProps(hook, 'set');
};


/** Example 3. Handle after method called (change result). */
const exampleHookAfter = () => {
  const hook = (props, result) => ([props, +result]);

  const beforeHooked = model.getSubscribers();
  console.log('Before add hook:', `${ beforeHooked }(type: ${ typeof(beforeHooked) })`);
  model.useResult(hook, 'getSubscribers');

  const afterHooked = model.getSubscribers();
  console.log('After add hook:', `${ afterHooked }(type: ${ typeof(afterHooked) })`);
  model.unUseResult(hook, 'getSubscribers');
};


/** Example 4. Calculated properties. */
const exampleCalcProps = () => {
  const hook = (state) => {
    if ('fullName' in state)
      console.log(`current fullName: ${ state.fullName }`);
  };

  model.useEvent(hook, 'set');
  model.name = 'Grigory';
  model.family = 'Markov';
  model.unUseEvent(hook, 'set');
};

const logChanges = () => { console.log(model.toObject()); };
model.useEvent(logChanges, 'set');
window.model = model;

(() => {
  runExample(exampleHookEvents, 'Example 1. Hook events.');
  runExample(exampleHookBefore, 'Example 2. Handle before method call (change props).');
  runExample(exampleHookAfter, 'Example 3. Handle after method called (change result).');
  runExample(exampleCalcProps, 'Example 4. Calculated properties.');
})();

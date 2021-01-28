"use strict";

const TYPE_USE = Object.freeze({ PROPS: 'p', RESULT: 'r', EVENT: 'e' });
const DEFAULT_SILENTS = new Set([
  'use', 'unUse',
  'useProps', 'unUseProps',
  'useResult', 'unUseResult',
  'useEvent', 'unUseEvent',
  'toObject'
]);
const handlers = new WeakMap();
const silents = new WeakMap();
const calculates = new WeakMap();

const runMiddlewares = (context, method) => {
  const _methods = handlers.get(context);
  const _types = _methods?.[method];
  const _allTypes = _methods?._;

  return (type, ...props) => {
    const _middlewares = [...(_types?.[type] || []), ...(_allTypes?.[type] || [])];
    if (!_middlewares.length)
      return props;

    if (type === TYPE_USE.EVENT) {
      _middlewares.forEach(middleware => middleware(...props));
    } else {
      return _middlewares.reduce((newProps, middleware) => {
        return middleware(...newProps);
      }, props);
    }
    return props;
  };
};

const propsCalculate = (receiver, state, current) => {
  const handlers = calculates.get(receiver);
  if (handlers) {
    const calculate = (state) => {
      const fullState = { ...current, ...state };
      const calcState = [];
      handlers.forEach(([property, handler]) => {
        const newValue = handler(state, current);
        if (newValue !== fullState[property])
          calcState.push([property, newValue])
      });
  
      return (calcState.length) ? calculate({ ...state, ...Object.fromEntries(calcState)}) : state;
    };
    return calculate(state);
  }

  return state;
};

const set = (context, target, state) => {
  const updatedProps = [];
  const run = runMiddlewares(context, 'set');
  const current = Object.freeze({ ...target });
  const calcState = propsCalculate(context, state, current);
  const [newState] = run(TYPE_USE.PROPS, calcState, current);

  Object.entries(newState).forEach(([property, value]) => {
    if (target[property] !== value) {
      updatedProps.push(property);
      target[property] = value;
    }
  });
  
  const isUpdated = !!updatedProps.length;
  isUpdated && run(TYPE_USE.EVENT, newState, updatedProps);

  return isUpdated;
};

const isPublic = property => (!property.startsWith('_'));

const toObject = (state) => {
  let object = {};
  Object.entries(state).forEach(([key, value]) => {
    if (isPublic(key))
      object[key] = value;
  });
  return object;
};

const proxyHandlers = {
  set: (target, property, value, receiver) => {
    set(receiver, target, { [property]: value });
  },
  get: (target, property, receiver) => {
    if (!isPublic(property))
      return void 0;
    if (property === 'set')
      return (state) => set(receiver, target, state);
    if (property === 'toObject')
      return () => toObject(target);

    const value = target[property];
    if (typeof value === 'function' && !silents.get(receiver)?.has(property)) {
      const run = runMiddlewares(receiver, property);
      return (...props) => {
        const newProps = run(TYPE_USE.PROPS, ...props);
        const [_, res] = run(TYPE_USE.RESULT, props, value.apply(receiver, newProps));
        run(TYPE_USE.EVENT, property, newProps, res);
        return res;
      }
    }
    return value;
  },
  getOwnPropertyDescriptor: (target, property) => {
    return (isPublic(property)) ? Object.getOwnPropertyDescriptor(target, property) : void 0;
  },
  has: (target, property) => (isPublic(property) && property in target),
  ownKeys: (target) => Object.keys(target).filter(property => isPublic(property)),
  deleteProperty: (target, property) => (isPublic(property) ? false : delete target[property])
};

const checkMethods = (methods) => {
  return (typeof methods === 'string') ? [methods] : (methods.length === 0 ? ['_'] : methods);
};

const USE = (context, handler, methods, type) => {
  const _methods = { ...(handlers.get(context) || {}) };

  checkMethods(methods).forEach(_method => {
    const _types = { ...(_methods?.[_method] || {}) };
    _types[type] = [...(_types?.[type] || []), handler];
    _methods[_method] = _types;
  });

  handlers.set(context, _methods);
};

const UNUSE = (context, handler, methods, type) => {
  const _methods = handlers.get(context);
  if (_methods) {
    checkMethods(methods).forEach(method => {
      const _types = _methods[method];
      _methods[method] = {
        _types,
        [type]: (_types?.[type] || []).filter(hook => hook !== handler)
      };
    });
  }
};

class SonexModel {
  constructor(state, calculateProps = null) {
    const instance = new Proxy(this, proxyHandlers);
    silents.set(instance, new Set([...DEFAULT_SILENTS]));

    if (calculateProps)
      calculates.set(instance, Object.entries(calculateProps));

    instance.set(state);
    
    return instance;
  }

  useProps(handler, methods) {
    USE(this, handler, methods, TYPE_USE.PROPS);
  }
  unUseProps(handler, methods) {
    UNUSE(this, handler, methods, TYPE_USE.PROPS);
  }

  useResult(handler, methods) {
    USE(this, handler, methods, TYPE_USE.RESULT);
  }
  unUseResult(handler, methods) {
    UNUSE(this, handler, methods, TYPE_USE.RESULT);
  }

  useEvent(handler, methods) {
    USE(this, handler, methods, TYPE_USE.EVENT);
  }
  unUseEvent(handler, methods) {
    UNUSE(this, handler, methods, TYPE_USE.EVENT);
  }
};
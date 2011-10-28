/*jslint onevar:true, undef:true, newcap:true, regexp:true, bitwise:true, maxerr:50, indent:4, white:false, nomen:false, plusplus:false */
/*global define:false, require:false, exports:false, module:false*/

/*!!
 * JS Signals <http://millermedeiros.github.com/js-signals/>
 * Released under the MIT license <http://www.opensource.org/licenses/mit-license.php>
 * @author Miller Medeiros <http://millermedeiros.com/>
 * @version 0.6.3+
 * @build 227 (2011/10/28 11:59 AM)
 */
(function(global){

    /**
     * @namespace Signals Namespace - Custom event/messaging system based on AS3 Signals
     * @name signals
     */
    var signals = /** @lends signals */{
        /**
         * Signals Version Number
         * @type String
         * @const
         */
        VERSION : '0.6.3+'
    };



    // SignalBinding -------------------------------------------------
    //================================================================

    /**
     * Object that represents a binding between a Signal and a listener function.
     * <br />- <strong>This is an internal constructor and shouldn't be called by regular users.</strong>
     * <br />- inspired by Joa Ebert AS3 SignalBinding and Robert Penner's Slot classes.
     * @author Miller Medeiros
     * @constructor
     * @internal
     * @name signals.SignalBinding
     * @param {signals.Signal} signal	Reference to Signal object that listener is currently bound to.
     * @param {Function} listener	Handler function bound to the signal.
     * @param {boolean} isOnce	If binding should be executed just once.
     * @param {Object} [listenerContext]	Context on which listener will be executed (object that should represent the `this` variable inside listener function).
     * @param {Number} [priority]	The priority level of the event listener. (default = 0).
     */
    function SignalBinding(signal, listener, isOnce, listenerContext, priority) {

        /**
         * Handler function bound to the signal.
         * @type Function
         * @private
         */
        this._listener = listener;

        /**
         * If binding should be executed just once.
         * @type boolean
         * @private
         */
        this._isOnce = isOnce;

        /**
         * Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @memberOf signals.SignalBinding.prototype
         * @name context
         * @type Object|undefined|null
         */
        this.context = listenerContext;

        /**
         * Reference to Signal object that listener is currently bound to.
         * @type signals.Signal
         * @private
         */
        this._signal = signal;

        /**
         * Listener priority
         * @type Number
         * @private
         */
        this._priority = priority || 0;
    }

    SignalBinding.prototype = /** @lends signals.SignalBinding.prototype */ {

        /**
         * If binding is active and should be executed.
         * @type boolean
         */
        active : true,

        /**
         * Default parameters passed to listener during `Signal.dispatch` and `SignalBinding.execute`. (curried parameters)
         * @type Array|null
         */
        params : null,

        /**
         * Call listener passing arbitrary parameters.
         * <p>If binding was added using `Signal.addOnce()` it will be automatically removed from signal dispatch queue, this method is used internally for the signal dispatch.</p>
         * @param {Array} [paramsArr]	Array of parameters that should be passed to the listener
         * @return {*} Value returned by the listener.
         */
        execute : function (paramsArr) {
            var handlerReturn, params;
            if (this.active && !!this._listener) {
                params = this.params? this.params.concat(paramsArr) : paramsArr;
                handlerReturn = this._listener.apply(this.context, params);
                if (this._isOnce) {
                    this.detach();
                }
            }
            return handlerReturn;
        },

        /**
         * Detach binding from signal.
         * - alias to: mySignal.remove(myBinding.getListener());
         * @return {Function|null} Handler function bound to the signal or `null` if binding was previously detached.
         */
        detach : function () {
            return this.isBound()? this._signal.remove(this._listener) : null;
        },

        /**
         * @return {Boolean} `true` if binding is still bound to the signal and have a listener.
         */
        isBound : function () {
            return (!!this._signal && !!this._listener);
        },

        /**
         * @return {Function} Handler function bound to the signal.
         */
        getListener : function () {
            return this._listener;
        },

        /**
         * Delete instance properties
         * @private
         */
        _destroy : function () {
            delete this._signal;
            delete this._listener;
            delete this.context;
        },

        /**
         * @return {boolean} If SignalBinding will only be executed once.
         */
        isOnce : function () {
            return this._isOnce;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[SignalBinding isOnce:' + this._isOnce +', isBound:'+ this.isBound() +', active:' + this.active + ']';
        }

    };


/*global signals:false, SignalBinding:false*/

    // Signal --------------------------------------------------------
    //================================================================

    function validateListener(listener, fnName) {
        if (typeof listener !== 'function') {
            throw new Error( 'listener is a required param of {fn}() and should be a Function.'.replace('{fn}', fnName) );
        }
    }

    /**
     * Custom event broadcaster
     * <br />- inspired by Robert Penner's AS3 Signals.
     * @author Miller Medeiros
     * @constructor
     */
    signals.Signal = function () {
        /**
         * @type Array.<SignalBinding>
         * @private
         */
        this._bindings = [];
        this._prevParams = null;
    };

    signals.Signal.prototype = {

        /**
         * If Signal should keep record of previously dispatched parameters and
         * automatically execute listener during `add()`/`addOnce()` if Signal was
         * already dispatched before.
         * @type boolean
         */
        memorize : false,

        /**
         * @type boolean
         * @private
         */
        _shouldPropagate : true,

        /**
         * If Signal is active and should broadcast events.
         * <p><strong>IMPORTANT:</strong> Setting this property during a dispatch will only affect the next dispatch, if you want to stop the propagation of a signal use `halt()` instead.</p>
         * @type boolean
         */
        active : true,

        /**
         * @param {Function} listener
         * @param {boolean} isOnce
         * @param {Object} [scope]
         * @param {Number} [priority]
         * @return {SignalBinding}
         * @private
         */
        _registerListener : function (listener, isOnce, scope, priority) {

            var prevIndex = this._indexOfListener(listener),
                binding;

            if (prevIndex !== -1) { //avoid creating a new Binding for same listener if already added to list
                binding = this._bindings[prevIndex];
                if (binding.isOnce() !== isOnce) {
                    throw new Error('You cannot add'+ (isOnce? '' : 'Once') +'() then add'+ (!isOnce? '' : 'Once') +'() the same listener without removing the relationship first.');
                }
            } else {
                binding = new SignalBinding(this, listener, isOnce, scope, priority);
                this._addBinding(binding);
            }

            if(this.memorize && this._prevParams){
                binding.execute(this._prevParams);
            }

            return binding;
        },

        /**
         * @param {SignalBinding} binding
         * @private
         */
        _addBinding : function (binding) {
            //simplified insertion sort
            var n = this._bindings.length;
            do { --n; } while (this._bindings[n] && binding._priority <= this._bindings[n]._priority);
            this._bindings.splice(n + 1, 0, binding);
        },

        /**
         * @param {Function} listener
         * @return {number}
         * @private
         */
        _indexOfListener : function (listener) {
            var n = this._bindings.length;
            while (n--) {
                if (this._bindings[n]._listener === listener) {
                    return n;
                }
            }
            return -1;
        },

        /**
         * Check if listener was attached to Signal.
         * @param {Function} listener
         * @return {boolean} if Signal has the specified listener.
         */
        has : function (listener) {
            return this._indexOfListener(listener) !== -1;
        },

        /**
         * Add a listener to the signal.
         * @param {Function} listener	Signal handler function.
         * @param {Object} [scope]	Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority]	The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        add : function (listener, scope, priority) {
            validateListener(listener, 'add');
            return this._registerListener(listener, false, scope, priority);
        },

        /**
         * Add listener to the signal that should be removed after first execution (will be executed only once).
         * @param {Function} listener	Signal handler function.
         * @param {Object} [scope]	Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority]	The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        addOnce : function (listener, scope, priority) {
            validateListener(listener, 'addOnce');
            return this._registerListener(listener, true, scope, priority);
        },

        /**
         * Remove a single listener from the dispatch queue.
         * @param {Function} listener	Handler function that should be removed.
         * @return {Function} Listener handler function.
         */
        remove : function (listener) {
            validateListener(listener, 'remove');

            var i = this._indexOfListener(listener);
            if (i !== -1) {
                this._bindings[i]._destroy(); //no reason to a SignalBinding exist if it isn't attached to a signal
                this._bindings.splice(i, 1);
            }
            return listener;
        },

        /**
         * Remove all listeners from the Signal.
         */
        removeAll : function () {
            var n = this._bindings.length;
            while (n--) {
                this._bindings[n]._destroy();
            }
            this._bindings.length = 0;
        },

        /**
         * @return {number} Number of listeners attached to the Signal.
         */
        getNumListeners : function () {
            return this._bindings.length;
        },

        /**
         * Stop propagation of the event, blocking the dispatch to next listeners on the queue.
         * <p><strong>IMPORTANT:</strong> should be called only during signal dispatch, calling it before/after dispatch won't affect signal broadcast.</p>
         * @see signals.Signal.prototype.disable
         */
        halt : function () {
            this._shouldPropagate = false;
        },

        /**
         * Dispatch/Broadcast Signal to all listeners added to the queue.
         * @param {...*} [params]	Parameters that should be passed to each handler.
         */
        dispatch : function (params) {
            if (! this.active) {
                return;
            }

            var paramsArr = Array.prototype.slice.call(arguments),
                bindings = this._bindings.slice(), //clone array in case add/remove items during dispatch
                n = bindings.length;

            if(this.memorize){
                this._prevParams = paramsArr;
            }

            this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.

            //execute all callbacks until end of the list or until a callback returns `false` or stops propagation
            //reverse loop since listeners with higher priority will be added at the end of the list
            do { n--; } while (bindings[n] && this._shouldPropagate && bindings[n].execute(paramsArr) !== false);
        },

        /**
         * Forget memorized arguments.
         * @see signals.Signal.memorize
         */
        forget : function(){
            this._prevParams = null;
        },

        /**
         * Remove all bindings from signal and destroy any reference to external objects (destroy Signal object).
         * <p><strong>IMPORTANT:</strong> calling any method on the signal instance after calling dispose will throw errors.</p>
         */
        dispose : function () {
            this.removeAll();
            delete this._bindings;
            delete this._prevParams;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[Signal active:'+ this.active +' numListeners:'+ this.getNumListeners() +']';
        }

    };



/*global signals:false, SignalBinding:false, inheritPrototype:false*/

    // CompoundSignal ---------------------------------------------------
    //================================================================

    (function(){

        var _signalProto = signals.Signal.prototype,
            _compoundProto = new signals.Signal();

        function slice(arr, offset){
            return Array.prototype.slice.call(arr, offset || 0);
        }

        // --

        /**
         * CompoundSignal works like a group of signals which should be
         * dispatched automatically after all the signals contained by the
         * group are dispatched. Arguments are passed to listeners as Arrays on
         * the same order as the signals were passed on the constructor.
         * <br><br>
         * If you are familiar with Promise/Deferred think of it as Promise
         * which will be resolved after all the signals on the group are
         * dispatched.
         * @name signals.CompoundSignal
         * @param {...signal.Signal} signals Signals that should be grouped.
         * @constructor
         * @extends signals.Signal
         */
        function CompoundSignal(params){
            signals.Signal.call(this);

            var sigs = slice(arguments),
                n = sigs.length,
                binding;

            while(n--){
                binding = sigs[n].add(this._registerDispatch, this);
                binding.params = [n]; //use index to register params..
            }

            this._signals = sigs;
            this._params = [];
            this._resolved = false;
        }

        CompoundSignal.prototype = _compoundProto;
        CompoundSignal.prototype.constructor = CompoundSignal;

        /**
         * Sets if multiple dispatches of same signal should override
         * previously registered parameters. Default value is `false`.
         * @name signals.CompoundSignal.prototype.override
         * @type boolean
         */
        _compoundProto.override = false;

        /**
         * If `true` CompoundSignal will act like a "Promise", after first
         * dispatch, subsequent dispatches will always pass same arguments. It
         * will also remove all the listeners automatically after dispatch.
         * Default value is `true`.
         * @name signals.CompoundSignal.prototype.unique
         * @type boolean
         */
        _compoundProto.unique = true;

        /**
         * If `true` it will store a reference to previously dispatched
         * arguments and will automatically execute callbacks during
         * `add()`/`addOnce()` (similar to a "Promise"). Default value
         * is `true`.
         * @name signals.CompoundSignal.prototype.memorize
         * @type boolean
         */
        _compoundProto.memorize = true;

        _compoundProto._registerDispatch = function(idx, args){

            if(!this._params[idx] || this.override){
                this._params[idx] = slice(arguments, 1);
            }

            if( this._registeredAll() && (!this._resolved || !this.unique)){
                this.dispatch.apply(this, this._params);
            }
        };

        _compoundProto._registeredAll = function(){
            if(this._params.length !== this._signals.length){
                return false;
            } else {
                //check if any item is undefined, dispatched signals will
                //store an empty array if no param passed on dispatch..
                for(var i = 0, n = this._params.length; i < n; i += 1){
                    if(! this._params[i]){
                        return false;
                    }
                }
                return true;
            }
        };

        /**
         * Works similar to a regular Signal `dispatch()` method but if
         * CompoundSignal was already "resolved" and it is `unique`, it will
         * always dispatch the same arguments, no mather which parameters are
         * passed to the `dispatch` method.
         * @name signals.CompoundSignal.prototype.dispatch
         * @function
         * @see signals.Signal.dispatch
         * @see signals.CompoundSignal.unique
         */
        _compoundProto.dispatch = function(params){

            //if unique it should always dispatch same parameters
            //will act like a promise...
            params = (this._resolved && this.unique)? this._params : slice(arguments);
            this._resolved = true;

            _signalProto.dispatch.apply(this, params);

            if(this.unique){
                this.removeAll();
            } else {
                this.reset();
            }
        };

        /**
         * Restore CompoundSignal to it's original state. Will consider as if
         * no signals was dispatched yet and will mark CompoundSignal as
         * unresolved.
         * @name signals.CompoundSignal.prototype.reset
         * @function
         */
        _compoundProto.reset = function(){
            this._params.length = 0;
            this._resolved = false;
        };

        /**
         * Check if CompoundSignal did resolved.
         * @name signals.CompoundSignal.prototype.isResolved
         * @function
         * @return {boolean} if CompoundSignal is resolved.
         */
        _compoundProto.isResolved = function(){
            return this._resolved;
        };

        _compoundProto.dispose = function(){
            _signalProto.dispose.call(this);
            delete this._signals;
            delete this._params;
        };

        _compoundProto.toString = function(){
            return '[CompoundSignal active:'+ this.active +' numListeners:'+ this.getNumListeners() +']';
        };

        //expose
        signals.CompoundSignal = CompoundSignal;

    }());


    //exports to multiple environments
    if(typeof define === 'function' && define.amd){ //AMD
        define('signals', [], signals);
    } else if (typeof module !== 'undefined' && module.exports){ //node
        module.exports = signals;
    } else { //browser
        //use string because of Google closure compiler ADVANCED_MODE
        global['signals'] = signals;
    }

}(this));

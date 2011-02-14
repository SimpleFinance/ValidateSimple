/*
---

name: ValidateSimple
script: ValidateSimple.js
description: Simple form validation with good UX

requires:
  - Core/Class.Extras
  - Core/Element.Event
  - More/Events.Pseudos
  - More/Class.Binds

provides: [ValidateSimple]

authors:
  - Ian Collins

...
*/

var ValidateSimple = new Class({
  
  Implements: [Events, Options],
  
  Binds: ['checkValid', 'onSubmit'],
  
  options: {
    active: true,
    validateOnSubmit: true,
    inputSelector: 'input',
    invalidClass: 'invalid',
    validClass: 'valid',
    optionalClass: 'optional',
    attributeForType: 'class',
    alertEvent: 'blur',
    correctionEvent: 'keyup',
    validateEvent: 'keyup',
    checkPeriodical: 1000
  },
  
  state: 'untouched',
  
  initialize: function(element, options){
    this.setOptions(options);
    
    this.element = document.id(element);
    this.inputs  = this.options.inputs || this.element.getElements(this.options.inputSelector);
    
    this.inputs = this.inputs.filter(function(input){
      return !input.hasClass(this.options.optionalClass); // todo or hidden or disabled
    }, this);
    
    if (this.options.active)
      this.activate();
    
    return this;
  },
  
  attach: function(){
    if (!this.active){
      this.active = true;    
      this.inputs.each(function(input){
        var callbacks = [this.validateInput.pass(input, this), this.alertInputValidity.pass(input, this)];
        input.addEvent(this.options.validateEvent, callbacks[0]);
        input.addEvent('change', callbacks[0]);
        input.addEvent(this.options.alertEvent, callbacks[1]);
        input.store('vs-previous-value', input.get('value'));        
        input.store('validate-simple-callbacks', callbacks);
      }, this);
      
      if (this.options.validateOnSubmit)
        this.element.addEvent('submit', this.onSubmit);
      
      if (this.options.checkPeriodical)
        this.checkForChangedInputsPeriodical = this.checkForChangedInputs.periodical(this.options.checkPeriodical, this);
    }
    
    return this;
  },
  detach: function(){
    this.active = false;
    this.inputs.each(function(input){          
      var callbacks = input.retrieve('validate-simple-callbacks');
      if (callbacks){
        input.removeEvent(this.options.validateEvent, callbacks[0]);
        input.removeEvent('change', callbacks[0]);
        input.removeEvent(this.options.alertEvent, callbacks[1]);
        if (callbacks[2])
          input.removeEvent(this.options.correctionEvent, callbacks[2]);
      }
      input.store('validate-simple-watching', false);
    }, this);
    
    if (this.options.validateOnSubmit)
      this.element.removeEvent('submit', this.onSubmit);
        
    clearInterval(this.checkForChangedInputsPeriodical);
  },
  
  onSubmit: function(e){
    if (!this.validateAllInputs()){
      if (e) e.preventDefault();
      this.fireEvent('invalidSubmit', [this, e]);
    } else
      this.fireEvent('validSubmit', [this, e]);
  },
  
  activate: function(){ this.attach(); },
  deactivate: function(){ this.detach(); },  
  
  validateInput: function(input){
    if (this.state == 'untouched')
      this.changeState('touched');

    var validatorTypes = input.get(this.options.attributeForType),
        validators = [],    
        errors = [];
    
    if (this.options.attributeForType == 'class'){
      var mtch = validatorTypes.match(/validate\-\w+/g);
      validatorTypes = (mtch && mtch.length > 0) ? mtch : ['text'];
    }
    validatorTypes = $A(validatorTypes);
    
    input.store('validate-simple-is-valid', true);

    validatorTypes.each(function(validatorType){
      var validatorType = validatorType.replace('validate-',''),
          validator = ValidateSimple.Validators[validatorType];
      
      if (!validator.test(input)){
        input.store('validate-simple-is-valid', false);
        errors.include(validatorType);
        input.store('validate-simple-errors', errors);
        this.changeState('invalid');
      }
    }, this);
    
    if (input.retrieve('validate-simple-is-valid'))
      this.alertInputValidity(input);

    this.checkValid();
  },
  validateAllInputs: function(){
    this.inputs.each(function(input){
      this.validateInput(input);
    }, this);
    return this.state == 'valid';
  },
  
  alertInputValidity: function(input){
    if (this.state != 'untouched'){
      if (input.retrieve('validate-simple-is-valid')){
        input.addClass(this.options.validClass).removeClass(this.options.invalidClass);
        this.fireEvent('inputValid', [input, this]);
      } else {
        input.addClass(this.options.invalidClass).removeClass(this.options.validClass);
        this.fireEvent('inputInvalid', [input, input.retrieve('validate-simple-errors'), this]);
      }
    }
    
    if (!input.retrieve('validate-simple-watching')){
      var callback = this.alertInputValidity.pass(input, this);
      input.addEvent(this.options.correctionEvent, callback);
      input.store('validate-simple-watching', true);
      var callbacks = input.retrieve('validate-simple-callbacks');
      input.store('validate-simple-callbacks', callbacks.include(callback));
    }
  },
  
  checkForChangedInputs: function(){
    this.inputs.each(function(input){
      var previous = input.retrieve('vs-previous-value'),
          current = input.get('value');

      if (previous != current)
        this.validateInput(input);
      
      input.store('vs-previous-value', current);
    }, this);
  },

  checkValid: function(){
    var allInputsValidOrOptional = this.inputs.every(function(input){
      return input.retrieve('validate-simple-is-valid') || input.hasClass(this.options.optionalClass);
    }, this);
    
    this.changeState(allInputsValidOrOptional ? 'valid' : 'invalid');
  },
  
  changeState: function(state){
    this.state = state;
    this.element.addClass(state);
    if (state == 'valid') this.element.removeClass('invalid');
    else if (state == 'invalid') this.element.removeClass('valid');    
    this.fireEvent(state, this);
  }
  
});


ValidateSimple.Validators = {
  'email': {
    test: function(input){
      return input.get('value').test(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i);
    }
  },
  'text': {
    test: function(input){
      return ((input.get('value') != null) && (input.get('value').length > 0));       
    }
  },
  'name': {
    test: function(input){
      return input.get('value').test(/^[A-Za-z -'&]+$/);
    }
  },
  'url': {
    test: function(input){
      return input.get('value').test(/^(https?|ftp|rmtp|mms):\/\/(([A-Z0-9][A-Z0-9_-]*)(\.[A-Z0-9][A-Z0-9_-]*)+)(:(\d+))?\/?/i);
    }
  },
  'alpha': {
    test: function(input){
      return input.get('value').test(/^[a-zA-Z]+$/);
    }
  },
  'alphanumeric': {
    test: function(input){
      return !input.get('value').test(/\W/);
    }
  },
  'numeric': {
    test: function(input){
      return input.get('value').test(/^-?(?:0$0(?=\d*\.)|[1-9]|0)\d*(\.\d+)?$/);
    }
  }
};
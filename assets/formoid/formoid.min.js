var Formoid = (function () {

    var API_URL = 'https://formoid.net/api/push';

    function $ajax(url, settings) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open(settings.type, url);
            xhr.onload = function () {
                if (xhr.status !== 200) {
                    return reject(new Error('Incorrect server response.'));
                }
                resolve(xhr.responseText);
            };
            xhr.onerror = function () {
                var message = 'Failed to query the server. ';
                if ('onLine' in navigator && !navigator.onLine) {
                    message += 'No connection to the Internet.';
                } else {
                    message += 'Check the connection and try again.';
                }
                reject(new Error(message));
            };
            xhr.send(settings.data);
        })
    };

    var prop = function (name, args) {
        name = '__' + name + '__';
        if (args.length) {
            this[name] = args[0];
            return this;
        }
        return this[name];
    };

    var Form = function (settings) {
        settings = settings || {};
        this.__email__ = settings.email || '';
        this.__title__ = settings.title || '';
        this.__data__ = settings.data || [];
    };

    Form.prototype.email = function (value) {
        return prop.call(this, 'email', arguments);
    };

    Form.prototype.title = function (value) {
        return prop.call(this, 'title', arguments);
    };

    Form.prototype.data = function (value) {
        return prop.call(this, 'data', arguments);
    };

    Form.prototype.send = function (data) {
        return $ajax(API_URL, {
            type: 'POST',
            data: JSON.stringify({
                email: this.__email__,
                form: {
                    title: this.__title__,
                    data: (arguments.length ? data : this.__data__)
                }
            })
        })
        .then(function(responseText) {
            var data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                throw new Error('Incorrect server response.');
            }
            if (data.error) {
                throw new Error(data.error);
            }
            return data.response;
        });
    };

    return {
        Form: function (settings) {
            return new Form(settings);
        }
    }

})();

const formModalDOM = document.createElement('div');
let formModal;

formModalDOM.classList.add('modal');
formModalDOM.setAttribute('tabindex', -1);
formModalDOM.style.overflow = 'hidden';

if (typeof bootstrap !== 'undefined') {
    if (bootstrap.Tooltip.VERSION.startsWith(5)) {
        //bs5
        formModalDOM.innerHTML = `
            <div class="modal-dialog d-flex align-items-center" style="">
                <div class="modal-content" style="height:auto;border-radius:0;border:none;box-shadow: 0px 0px 5px 0px rgba(0,0,0,0.25);">
                    <div class="modal-body d-flex justify-content-end flex-column align-items-end">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        <p class="display-7" style="text-align:center;width:100%;">Modal body text goes here.</p>
                    </div>
                </div>
            </div>`
    } else {
        // bs4
        formModalDOM.innerHTML = `
            <div class="modal-dialog d-flex align-items-center" style="">
                <div class="modal-content" style="height:auto;border-radius:0;border:none;box-shadow: 0px 0px 5px 0px rgba(0,0,0,0.25);">
                    <div class="modal-body d-flex justify-content-end flex-column align-items-end">
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                        <p class="display-7" style="text-align:center;width:100%;">Modal body text goes here.</p>
                    </div>
                </div>
            </div>`
    }
} else if ($.fn.Tooltip) {
    // bs3
    formModalDOM.innerHTML = `
        <div class="modal-dialog d-flex align-items-center" style="">
            <div class="modal-content" style="height:auto;border-radius:0;border:none;box-shadow: 0px 0px 5px 0px rgba(0,0,0,0.25);">
                <div class="modal-body d-flex justify-content-end flex-column align-items-end">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <p class="display-7" style="text-align:center;width:100%;">Modal body text goes here.</p>
                </div>
            </div>
        </div>`
}

if (bootstrap) {
    formModal = new bootstrap.Modal(formModalDOM);
}

var isValidEmail = function (input) {
    return input.value ? /^([^@]+?)@(([a-z0-9]-*)*[a-z0-9]+\.)+([a-z0-9]+)$/i.test(input.value) : true;
};

var formComponents = document.querySelectorAll('[data-form-type="formoid"]');

formComponents.forEach(function (component) {
    var formData,
        form = component.tagName === 'FORM' ? component : component.querySelector('form'),
        alert = component.querySelector('[data-form-alert]'),
        title = component.getAttribute('data-form-title') ? component : component.querySelector('[data-form-title]'),
        submit = component.querySelector('[type="submit"]'),
        inputArr = component.querySelectorAll('[data-form-field]'),
        alertSuccess = alert.innerHTML;

    form.addEventListener('change', function (event) {
        if (event.target.type === 'file') {
            if (event.target.files[0].size > 1000000) {
                formModal._element.querySelector('.modal-body p').innerText = 'File size must be less than 1mb';
                formModal._element.querySelector('.modal-content').classList.add('alert-danger');
                formModal._element.querySelector('.modal-content').style.backgroundColor = '#ff9966';
                formModal.show();
                submit.classList.add('btn-loading');
                submit.setAttribute('disabled', true);
            }
        }
    });

    form.addEventListener('submit', function (event) {
        event.stopPropagation();
        event.preventDefault();

        if (submit.classList.contains('btn-loading')) return;

        var inputs = inputArr;

        form.classList.add('form-active');
        submit.classList.add('btn-loading');
        submit.setAttribute('disabled', true);
        alert.innerHTML = '';

        formData = formData || Formoid.Form({
            email: component.querySelector('[data-form-email]').value,
            title: title.getAttribute('data-form-title') || title.innerText
        });

        function parseInput(input) {
            return new Promise(function (resolve, reject) {
                // valide email
                if (input.getAttribute('name') === 'email' && !isValidEmail(input)) {
                    return reject(new Error('Form is not valid'));
                }
                var name = input.getAttribute('data-form-field') || input.getAttribute('name');
                switch (input.getAttribute('type')) {
                    case 'file':
                        var file = input.files[0];
                        if (!file) return resolve();
                        var reader = new FileReader()
                        reader.onloadend = function () {
                            resolve([name, reader.result]);
                        };
                        reader.onerror = function () {
                            reject(reader.error);
                        };
                        reader.readAsDataURL(file);
                        break;
                    case 'checkbox':
                        resolve([name, input.checked ? input.value : 'No']);
                        break;
                    case 'radio':
                        resolve(input.checked && [name, input.value]);
                        break;
                    default:
                        resolve([name, input.value]);
                }
            });
        }

        Promise
            .all(Array.prototype.map.call(inputs, function (input) { return parseInput(input); }))
            .then(function (data) { return formData.send(data.filter(function (v) { return v; })); })
            .then(function (message) {
                form.reset();
                form.classList.remove('form-active');
                formModal._element.querySelector('.modal-body p').innerText = alertSuccess || message;
                formModal._element.querySelector('.modal-content').classList.add('alert-success');
                formModal._element.querySelector('.modal-content').style.backgroundColor = '#70c770'
                formModal.show();
            }, function (err) {
                formModal._element.querySelector('.modal-body p').innerText = err.message;
                formModal._element.querySelector('.modal-content').classList.add('alert-danger');
                formModal._element.querySelector('.modal-content').style.backgroundColor = '#ff9966'
            })
            .then(function () {
                submit.classList.remove('btn-loading');
                submit.removeAttribute('disabled');
            });
    });

    inputArr.forEach(function (elem) {
        elem.addEventListener('focus', function () {
            submit.classList.remove('btn-loading')
            submit.removeAttribute('disabled');
        });
    });
})
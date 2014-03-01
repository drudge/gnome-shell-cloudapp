// vi: sw=2 sts=2
const Lang = imports.lang;
const Signals = imports.signals;
const Mainloop = imports.mainloop;

const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;

const _httpSession = new Soup.SessionAsync();


const Uploader = new Lang.Class({
  Name: "Uploader",
  _init: function () true
});


Signals.addSignalMethods(Uploader.prototype);

const CloudAppUploader = new Lang.Class({
  Name: "CloudAppUploader",
  Extends: Uploader,

  baseUrl: "http://my.cl.ly/items/new",
  
  _signalAuthenticate: null,

  _init: function (email, password) {
    log("new cloudapp uploader for " + email);
    //_httpSession['proxy-uri'] = Soup.URI.new('http://10.201.68.100:8080');
    this._signalAuthenticate = _httpSession.connect(
      "authenticate",
      Lang.bind(this, function (session, message, auth, retrying, user_data) {
        log("authenticate");
        auth.authenticate(email, password);
      })
    );
  },

  _getMimetype: function (filename) {
    return 'image/png'; // FIXME
  },
  
  _requestFileUpload: function(callback) {
     let request = Soup.Message.new('GET', this.baseUrl);
      request.request_headers.append("Accept", "application/json");
     let json = null;
     let err = null;
     
     _httpSession.queue_message(request,
        Lang.bind(this, function (session, {status_code, response_body}) {
          if (status_code == 200) {
            try {
                json = JSON.parse(response_body.data);
                
                log(response_body.data);
                if (json.uploads_remaining <= 0) {
                  this.emit('error', 'You have no more uploads today.');
                  return;
                }
            } catch (e) {
              err = e;
            }
          } else {
            log('getJSON error status code: ' + status_code);
            log('getJSON error response: ' + response_body.data);

            let errorMessage;

            try {
              errorMessage = JSON.parse(response_body.data).data.error;
            } catch (e) {
              log("failed to parse error message " + e);
              errorMessage = response_body.data
            }

            this.emit(
              'error',
              "HTTP " + status_code + " - " + errorMessage
            );
            
            err = e;
          }
          
          callback(err, json);
      }));
  },

  _getPostMessage: function (filename, req, callback) {
    let url = req.url;
    let file = Gio.File.new_for_path(filename);

    file.load_contents_async(null, Lang.bind(this, function (f, res) {
      let contents;

      try {
        [, contents] = f.load_contents_finish(res);
      } catch (e) {
        log("error loading file: " + e.message);
        callback(e, null);
        return;
      }
      
      if (contents.length > req.max_upload_size) {
        log('max upload size exceeded: ' + contents.length);
        callback(new Error('The file exceeds the maximum upload size'), null);
        return;
      }

      let buffer = new Soup.Buffer(contents, contents.length);
      let mimetype = this._getMimetype(filename);
      let multipart = new Soup.Multipart(Soup.FORM_MIME_TYPE_MULTIPART);
      
      for (let key in req.params) {
        log('adding ' + key + ' as ' + req.params[key]);
        multipart.append_form_string(key, req.params[key]);
      }
      
      multipart.append_form_file('file', filename, mimetype, buffer);

      let message = Soup.form_request_new_from_multipart(url, multipart);
      message.request_headers.append("Accept", "application/json");
      
      callback(null, message);
    }), null);
  },

  upload: function (filename) {
    this._requestFileUpload(Lang.bind(this, function (error, req) {
      if (error) {
        this.emit("error", error);
        return;
      }
      
      this._getPostMessage(filename, req, Lang.bind(this, function (error, message) {
        let total = message.request_body.length;
        let uploaded = 0;

        if (error) {
          this.emit("error", error);
          return;
        }

        let signalProgress = message.connect(
          "wrote-body-data",
          Lang.bind(this, function (message, buffer) {
            uploaded += buffer.length;
            this.emit("progress", uploaded, total);
          })
        );

        _httpSession.queue_message(message,
          Lang.bind(this, function (session, {status_code, response_body}) {
            if (status_code == 200) {
              log(response_body.data)
              this.emit('done', JSON.parse(response_body.data));
            } else {
              log('getJSON error status code: ' + status_code);
              log('getJSON error response: ' + response_body.data);

              let errorMessage;

              try {
                errorMessage = JSON.parse(response_body.data).error;
              } catch (e) {
                log("failed to parse error message " + e);
                errorMessage = response_body.data
              }

              this.emit(
                'error',
                "HTTP " + status_code + " - " + errorMessage
              );
            }

            message.disconnect(signalProgress);
        }));
      }));
    }));
  }
});

if (this['ARGV'] !== undefined) {

  // run by gjs
  log("command line");

  let uploader = new CloudAppUploader("email@domain.com", "password");

  uploader.connect("data", function (obj, data) {
    log(JSON.stringify(data));
  });

  uploader.upload("data/screenshot.png");

  Mainloop.run("main");
}

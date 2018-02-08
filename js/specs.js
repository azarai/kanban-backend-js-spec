function defineSpecsFor(apiRoot) {

  function getJson(url, options) {
    return getRaw(url, options).then(transformResponseToJson);
  }

  function getRaw(url, options) {
    return ajax("GET", url, options);
  }
  function post(url, data, options) {
    options = options || {};
    options.data = JSON.stringify(data);
    return ajax("POST", url, options);
  }
  function postJson(url, data, options) {
    return post(url, data, options).then(transformResponseToJson);
  }

  function put(url, data, options) {
    options = options || {};
    options.data = JSON.stringify(data);
    return ajax("PUT", url, options);
  }
  function putJson(url, data, options) {
    return put(url, data, options).then(transformResponseToJson);
  }

  function delete_(url, options) {
    return ajax("DELETE", url, options);
  }

  function guid() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
      s4() + '-' + s4() + s4() + s4();
  }

  var username = guid();
  var xauthtoken = null;
  var boardId = null;
  var taskId = null;

  function urlFromTodo(todo) { return todo.url; }

  describe("Kanban-Backend API residing at " + apiRoot, function () {

    function createFreshTodoAndGetItsUrl(params) {
      var postParams = _.defaults((params || {}), {
        title: "blah"
      });
      return postRoot(postParams)
        .then(urlFromTodo);
    };

    describe("register and login", function () {
      specify("register a new user", function () {
        return post(apiRoot + "/register", { username: username, password: "123456" }).
          then(function (rdata) {
            return Q.fcall(function () {
              return rdata.xhr.status;
            });
          }).then(function (status) {
            expect(status).to.equals(201);
          })
      });

      specify("login user", function () {
        var options = {
          beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Basic " + btoa(username + ":" + "123456"));
          }
        };
        return post(apiRoot + "/login", {}, options).
          then(function (rdata) {
            return Q.fcall(function () {
              xauthtoken = rdata.xhr.getResponseHeader("X-Auth-Token");
              return xauthtoken;
            });
          }).then(function (token) {
            expect(token, "X-Auth-Token is null").is.not.empty;
          })
      });
    });
    describe("check boards", function () {
      specify("create a board", function () {
        var options = {
          beforeSend: function (xhr) {
            xhr.setRequestHeader("X-Auth-Token", xauthtoken);
          }
        };
        var boardJson = postJson(apiRoot + "/boards", { name: "My board" }, options);

        return Q.all([
          expect(boardJson).to.eventually.have.property("name", "My board"),
          expect(boardJson).to.eventually.have.property("id").that.is.a('number')
        ]);
      });

      specify("list all board", function () {
        var options = {
          beforeSend: function (xhr) {
            xhr.setRequestHeader("X-Auth-Token", xauthtoken);
          }
        };
        var boardJson = getJson(apiRoot + "/boards", options);
        return boardJson.then(function (boardFromGet) {
          expect(boardFromGet).to.have.length(1);
          expect(boardFromGet[0]).to.have.property("name", "My board");
          expect(boardFromGet[0]).to.have.property("id").that.is.a('number')
          boardId = boardFromGet[0].id;
        });
      });
    });
    describe("check tasks", function () {
      specify("create a task", function () {
        var options = {
          beforeSend: function (xhr) {
            xhr.setRequestHeader("X-Auth-Token", xauthtoken);
          }
        };
        var taskJson = postJson(apiRoot + "/tasks/" + boardId, {
          "category": "cat1",
          "content": "Feed the cat",
          "lane": "ready"
        }, options).then(function (taskPosted) {
          taskId = taskPosted.id;
          return Q.fcall(function () {
            return taskPosted;
          });
        });

        return Q.all([
          expect(taskJson).to.eventually.have.property("content", "Feed the cat"),
          expect(taskJson).to.eventually.have.property("lane", "ready"),
          expect(taskJson).to.eventually.have.property("category", "cat1"),
          expect(taskJson).to.eventually.have.property("id").that.is.a('number')
        ]);
      });

      specify("list all tasks", function () {
        var options = {
          beforeSend: function (xhr) {
            xhr.setRequestHeader("X-Auth-Token", xauthtoken);
          }
        };
        var boardJson = getJson(apiRoot + "/tasks/" + boardId, options);
        return boardJson.then(function (tasksPosted) {
          expect(tasksPosted).to.have.length(1);
          expect(tasksPosted[0]).to.have.property("content", "Feed the cat");
          expect(tasksPosted[0]).to.have.property("lane", "ready"),
            expect(tasksPosted[0]).to.have.property("category", "cat1"),
            expect(tasksPosted[0]).to.have.property("id").that.is.equals(taskId)
        });
      });

      specify("update a task", function () {
        var options = {
          beforeSend: function (xhr) {
            xhr.setRequestHeader("X-Auth-Token", xauthtoken);
          }
        };
        var taskJson = putJson(apiRoot + "/task/" + taskId, {
          "category": "cat1",
          "content": "Feed the cat",
          "lane": "done"
        }, options);

        return Q.all([
          expect(taskJson).to.eventually.have.property("content", "Feed the cat"),
          expect(taskJson).to.eventually.have.property("lane", "done"),
          expect(taskJson).to.eventually.have.property("category", "cat1"),
          expect(taskJson).to.eventually.have.property("id").that.is.equals(taskId)
        ]);
      });

      specify("delete a task", function () {
        var options = {
          beforeSend: function (xhr) {
            xhr.setRequestHeader("X-Auth-Token", xauthtoken);
          }
        };
        var deleteTask = delete_(apiRoot + "/task/" + taskId, options);

        return deleteTask.then(function (rdata) {
          return Q.fcall(function () {
            return rdata.xhr.status;
          });
        }).then(function (status) {
          expect(status).to.equals(200);

          var options = {
            beforeSend: function (xhr) {
              xhr.setRequestHeader("X-Auth-Token", xauthtoken);
            }
          };
          expect(getJson(apiRoot + "/tasks/" + boardId, options)).to.eventually.be.empty;
        });
      });
    });
  });


  function transformResponseToJson(data) {
    try {
      return JSON.parse(data.data);
    } catch (e) {
      var wrapped = new Error("Could not parse response as JSON.");
      wrapped.stack = e.stack;
      throw wrapped;
    }
  }

  function interpretXhrFail(httpMethod, url, xhr) {
    var failureHeader = "\n\n" + httpMethod + " " + url + "\nFAILED\n\n";
    if (xhr.status == 0) {
      return Error(
        failureHeader
        + "The browser failed entirely when make an AJAX request.\n"
        + "Either there is a network issue in reaching the url, or the\n"
        + "server isn't doing the CORS things it needs to do.\n"
        + "Ensure that you're sending back: \n"
        + "  - an `access-control-allow-origin: *` header for all requests\n"
        + "  - an `access-control-allow-headers` header which lists headers such as \"Content-Type\"\n"
        + "\n"
        + "Also ensure you are able to respond to OPTION requests appropriately. \n"
        + "\n"
      );
    } else {
      return Error(
        failureHeader
        + xhr.status + ": " + xhr.statusText + " (" + xhr.responseText.replace(/\n*$/, "") + ")"
        + "\n\n"
      );
    }
  }

  function ajax(httpMethod, url, options) {
    var ajaxOptions = _.defaults((options || {}), {
      type: httpMethod,
      url: url,
      xhrFields: {
        withCredentials: true
      },
      crossDomain: true,
      contentType: "application/json",
      dataType: "text", // so we can explicitly parse JSON and fail with more detail than jQuery usually would give us
      timeout: 30000 // so that we don't fail while waiting on a heroku dyno to spin up
    });

    var xhr = $.ajax(ajaxOptions);

    return Q.promise(function (resolve, reject) {
      xhr.success(function (data, status, xhr) {
        return resolve({
          data: data,
          status: status,
          xhr: xhr
        });
      });
      xhr.fail(function () {
        reject(interpretXhrFail(httpMethod, url, xhr));
      });
    });
  };
}


var savedConfig = null;
var installed = false;
var client, domain, api_key, roleAPI = true;
String.prototype.replaceAll = function (search, replacement) {
  var target = this;
  return target.replace(new RegExp(search, "g"), replacement);
};

function recursiveGetData(client, xurl, oneTime) {
  var dataList = [];
  return Promise.resolve().then(function () {
    var url = new URL(xurl);
    var domain_name = url.hostname;
    var endPoint = `${url.pathname}${url.search}`
    return client.request.invokeTemplate("recursiveGetDataTemplate", { context: { path: endPoint, host: domain_name, api_key: api_key } }).then(function (data) {
      if (data.hasOwnProperty("status") && data.status !== 200) {
        throw data;
      }
      dataList = dataList.concat(JSON.parse(data.response));
      if (data.headers.hasOwnProperty("link") && oneTime !== true) {
        var link = data.headers.link;
        var regex = /^<(.*)>;/;
        link = link.match(regex)[1];
        return recursiveGetData(client, link).then(function (data) {
          dataList = dataList.concat(data);
          return dataList;
        });
      }
      return dataList;
    })
      .catch(function (err) {
        err.handled = false;
        if (client.interface) {
          if (err.hasOwnProperty("status")) {
            var msg = "";
            var title = "";
            if (err.status === 429) {
              if (err.headers.hasOwnProperty("retry-after")) {
                msg = "You have reached request limit, please try after " + err.headers["retry-after"] + " secs.";
                title = "Code:" + err.status;
                client.interface.trigger("showNotify", {
                  type: "error",
                  title: title,
                  message: msg
                });
                err.handled = true;
              } else {
                msg = "You have reached request limit, please try after some time.";
                title = "Code:" + err.status;
                client.interface.trigger("showNotify", {
                  type: "error",
                  title: title,
                  message: msg
                });
                err.handled = true;
              }
            } else {
              try {
                msg = IsValidJSONString(err.response) ? JSON.parse(err.response).message : err.response;
                title = "Code:" + err.status;
                client.interface.trigger("showNotify", {
                  type: "error",
                  title: title,
                  message: msg
                });
                err.handled = true;
              } catch (x) {
                msg = JSON.stringify(err);
                title = "Error:";
                client.interface.trigger("showNotify", {
                  type: "error",
                  title: title,
                  message: msg
                });
                err.handled = true;
              }
            }
          } else {
            client.interface.trigger("showNotify", {
              type: "error",
              title: "Error",
              message: JSON.stringify(err)
            });
            err.handled = true;
          }
        }
        throw err;
      });
  });
}

function showLvl2() {
  getRoles();
  $("#iparams-lvl1").hide();
  $("#iparams-lvl2").show();
  $("#domain-apikey").hide();
  window.verified = true;
}

function verifyFailed() {
  $("#iparams-lvl1").show();
  $("#iparams-lvl2").hide();
  $("#domain-apikey").show();
  window.verified = false;
}

function IsValidJSONString(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}
// eslint-disable-next-line no-unused-vars
function verifyApiKey() {
  $("[name='verify']").button("loading");
  window.domain = $("#domain").val();
  window.api_key = $("#api_key").val();
  if (window.domain.length > 0 && window.api_key.length > 0) {
    if (window.domain.match(/^[a-zA-Z0-9-]+\.freshservice\.com$/)) {
      var url = "https://" + window.domain + "/api/v2/locations";
      var headers = {
        Authorization: "Basic " + btoa(window.api_key + ":x")
      };
      app.initialized().then(function (_client) {
        client = _client;
        client.db.get("iparam")
          .then(function (data) {
            // data["workspaceId"] = 2;
            if (data.validconfig) {
              const primaryWorkspaceId = 2;
              const modifiedConfig = {
                ws_configurations: {
                  primaryWorkspaceId: data
                }
              };
              modifiedConfig['ws_configurations']['workspaceId'] = primaryWorkspaceId;
              client.db.set("iparam", modifiedConfig).then(
                function () {
                  showNotify("succesfully modified the existing configuration to primary workspace");
                },
                function () {
                  // failure operation
                  showNotify("error", "could not modify existing configuration", "Something went wrong!");
                }
              );
            }
          }).catch(error => console.log(error));
        recursiveGetData(client, url, true)
          .then(function () {
            showLvl2();
          })
          .catch(function (error) {
            window.verified = false;
            var msg;
            if (error.hasOwnProperty("status")) {
              if (error.status === 401) {
                verifyFailed();
              } else if (error.status === 429) {
                if (error.headers.hasOwnProperty("retry-after")) {
                  msg = "You have reached request limit, please try after " + error.headers["retry-after"] + " secs.";
                  $("#generalError")
                    .html(msg)
                    .show()
                    .delay(5000)
                    .fadeOut(3000);
                } else {
                  msg = "You have reached request limit, please try after some time.";
                  $("#generalError")
                    .html(msg)
                    .show()
                    .delay(5000)
                    .fadeOut(3000);
                }
              } else {
                msg = IsValidJSONString(error.response) ? JSON.parse(error.response).message : error.response;
                $("#generalError")
                  .html(msg)
                  .show()
                  .delay(5000)
                  .fadeOut(3000);
              }
            } else {
              msg = JSON.stringify(error);
              $("#generalError")
                .html(msg)
                .show()
                .delay(5000)
                .fadeOut(3000);
            }
          });
      });
      $("#domainerror").hide();
      $("[name='verify']").button("reset");
    } else {
      $("#domainerror").show();
      $("[name='verify']").button("reset");
    }
  } else {
    $("#domain-apikey").show().css("visibility", "visible");
    $("[name='verify']").button("reset");
  }
}

// eslint-disable-next-line no-unused-vars
function getConfigs(config) {
  installed = true;
  savedConfig = config;
  $("#domain").val(config.domain);
  $("#api_key").val(config.api_key);
}

function validate() {
  var _bool = true,
    roleValues = $("#roles").val();
  $("#role-value-error").hide();
  if (!roleValues.length) {
    _bool = false;
    $("#role-value-error").show();
  }
  return _bool;
}

// eslint-disable-next-line no-unused-vars
function postConfigs() {
  var obj = {
    domain: $("#domain").val(),
    api_key: $("#api_key").val(),
    timezone: TIMEZONES,
    roleAPI: roleAPI,
    allowreportsfor: roleAPI == true ? $("#roles")
      .val()
      .map(Number) : $("#roles")
        .val()
        .map(String),
    __meta: {
      secure: ["api_key"]
    }
  };
  return obj;
}

function getRoles() {
  var eurl = "https://" + domain + "/api/v2/roles";
  recursiveGetData(client, eurl).then(function (data) {
    console.log("************");
    console.log(data);
    console.log("************");
    var _data = data.flatMap((element) => element.roles);
    $.each(Object.entries(_data), function (key, value) {
      $("#roles").append(
        $("<option></option>")
          .attr("value", value[1].id)
          .attr("selected", false)
          .text(value[1].name)
      );
    });
    if (installed) {
      $("#roles").val(savedConfig.allowreportsfor);
    }
    $("#role-select-container").removeClass("hide");
    $("#roles").select2();
  }, function (err) {
    roleAPI = false;
    var eurl = `https://${domain}/search/autocomplete/itil_agents.json`;
    $('#roles').select2({
      multiple: true,
      quietMillis: 500,
      minimumInputLength: 2,
      placeholder: "Start typing the name or email to search and select the agent",
      ajax: {
        url: eurl,
        dataType: 'json',
        headers: { Authorization: "Basic " + btoa(api_key + ":x") },
        processResults: function (data) {
          var results = [];
          $.each(data.results, function (i, item) {
            results.push({ id: item.email, text: item.value });
          });
          return { results: results }
        }
      }
    });
    $("#mail-select-container").removeClass("hide");
  });
}

const TIMEZONES = [
  {
    Timezone: "American Samoa",
    Offset: "UTC-11:00"
  },
  {
    Timezone: "International Date Line West",
    Offset: "UTC-11:00"
  },
  {
    Timezone: "Midway Island",
    Offset: "UTC-11:00"
  },
  {
    Timezone: "Hawaii",
    Offset: "UTC-10:00"
  },
  {
    Timezone: "Alaska",
    Offset: "UTC-09:00"
  },
  {
    Timezone: "Pacific Time (US & Canada)",
    Offset: "UTC-08:00"
  },
  {
    Timezone: "Tijuana",
    Offset: "UTC-08:00"
  },
  {
    Timezone: "Arizona",
    Offset: "UTC-07:00"
  },
  {
    Timezone: "Chihuahua",
    Offset: "UTC-07:00"
  },
  {
    Timezone: "Mazatlan",
    Offset: "UTC-07:00"
  },
  {
    Timezone: "Mountain Time (US & Canada)",
    Offset: "UTC-07:00"
  },
  // {
  //   Timezone: "America/Chicago",
  //   Offset: "UTC-06:00"
  // },
  {
    Timezone: "Central America",
    Offset: "UTC-06:00"
  },
  {
    Timezone: "Central Time (US & Canada)",
    Offset: "UTC-06:00"
  },
  {
    Timezone: "Guadalajara",
    Offset: "UTC-06:00"
  },
  {
    Timezone: "Mexico City",
    Offset: "UTC-06:00"
  },
  {
    Timezone: "Monterrey",
    Offset: "UTC-06:00"
  },
  {
    Timezone: "Saskatchewan",
    Offset: "UTC-06:00"
  },
  // {
  //   Timezone: "America/Bogota",
  //   Offset: "UTC-05:00"
  // },
  {
    Timezone: "Bogota",
    Offset: "UTC-05:00"
  },
  {
    Timezone: "Eastern Time (US & Canada)",
    Offset: "UTC-05:00"
  },
  {
    Timezone: "Indiana (East)",
    Offset: "UTC-05:00"
  },
  {
    Timezone: "Lima",
    Offset: "UTC-05:00"
  },
  {
    Timezone: "Quito",
    Offset: "UTC-05:00"
  },
  {
    Timezone: "Caracas",
    Offset: "UTC-04:30"
  },
  {
    Timezone: "Atlantic Time (Canada)",
    Offset: "UTC-04:00"
  },
  {
    Timezone: "Georgetown",
    Offset: "UTC-04:00"
  },
  {
    Timezone: "La Paz",
    Offset: "UTC-04:00"
  },
  {
    Timezone: "Santiago",
    Offset: "UTC-04:00"
  },
  {
    Timezone: "Newfoundland",
    Offset: "UTC-03:30"
  },
  {
    Timezone: "Brasilia",
    Offset: "UTC-03:00"
  },
  {
    Timezone: "Buenos Aires",
    Offset: "UTC-03:00"
  },
  // {
  //   Timezone: "Georgetown",
  //   Offset: "UTC-03:00"
  // },
  {
    Timezone: "Greenland",
    Offset: "UTC-03:00"
  },
  {
    Timezone: "Mid-Atlantic",
    Offset: "UTC-02:00"
  },
  {
    Timezone: "Azores",
    Offset: "UTC-01:00"
  },
  {
    Timezone: "Cape Verde Is.",
    Offset: "UTC-01:00"
  },
  {
    Timezone: "Casablanca",
    Offset: "UTC+00:00"
  },
  {
    Timezone: "Dublin",
    Offset: "UTC+00:00"
  },
  {
    Timezone: "Edinburgh",
    Offset: "UTC+00:00"
  },
  // {
  //   Timezone: "Europe/London",
  //   Offset: "UTC+00:00"
  // },
  {
    Timezone: "Lisbon",
    Offset: "UTC+00:00"
  },
  {
    Timezone: "London",
    Offset: "UTC+00:00"
  },
  {
    Timezone: "Monrovia",
    Offset: "UTC+00:00"
  },
  {
    Timezone: "UTC",
    Offset: "UTC+00:00"
  },
  {
    Timezone: "Amsterdam",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Belgrade",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Berlin",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Bern",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Bratislava",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Brussels",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Budapest",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Copenhagen",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Ljubljana",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Madrid",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Paris",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Prague",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Rome",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Sarajevo",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Skopje",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Stockholm",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Vienna",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Warsaw",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "West Central Africa",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Zagreb",
    Offset: "UTC+01:00"
  },
  {
    Timezone: "Athens",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Bucharest",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Cairo",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Harare",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Helsinki",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Istanbul",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Jerusalem",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Kyiv",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Pretoria",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Riga",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Sofia",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Tallinn",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Vilnius",
    Offset: "UTC+02:00"
  },
  {
    Timezone: "Baghdad",
    Offset: "UTC+03:00"
  },
  {
    Timezone: "Kuwait",
    Offset: "UTC+03:00"
  },
  {
    Timezone: "Minsk",
    Offset: "UTC+03:00"
  },
  {
    Timezone: "Moscow",
    Offset: "UTC+03:00"
  },
  {
    Timezone: "Nairobi",
    Offset: "UTC+03:00"
  },
  {
    Timezone: "Riyadh",
    Offset: "UTC+03:00"
  },
  {
    Timezone: "St. Petersburg",
    Offset: "UTC+03:00"
  },
  {
    Timezone: "Volgograd",
    Offset: "UTC+03:00"
  },
  {
    Timezone: "Tehran",
    Offset: "UTC+03:30"
  },
  {
    Timezone: "Abu Dhabi",
    Offset: "UTC+04:00"
  },
  {
    Timezone: "Baku",
    Offset: "UTC+04:00"
  },
  {
    Timezone: "Muscat",
    Offset: "UTC+04:00"
  },
  {
    Timezone: "Tbilisi",
    Offset: "UTC+04:00"
  },
  {
    Timezone: "Yerevan",
    Offset: "UTC+04:00"
  },
  {
    Timezone: "Kabul",
    Offset: "UTC+04:30"
  },
  {
    Timezone: "Ekaterinburg",
    Offset: "UTC+05:00"
  },
  {
    Timezone: "Islamabad",
    Offset: "UTC+05:00"
  },
  {
    Timezone: "Karachi",
    Offset: "UTC+05:00"
  },
  {
    Timezone: "Tashkent",
    Offset: "UTC+05:00"
  },
  {
    Timezone: "Chennai",
    Offset: "UTC+05:30"
  },
  {
    Timezone: "Kolkata",
    Offset: "UTC+05:30"
  },
  {
    Timezone: "Mumbai",
    Offset: "UTC+05:30"
  },
  {
    Timezone: "New Delhi",
    Offset: "UTC+05:30"
  },
  {
    Timezone: "Sri Jayawardenepura",
    Offset: "UTC+05:30"
  },
  {
    Timezone: "Kathmandu",
    Offset: "UTC+05:45"
  },
  {
    Timezone: "Almaty",
    Offset: "UTC+06:00"
  },
  {
    Timezone: "Astana",
    Offset: "UTC+06:00"
  },
  {
    Timezone: "Dhaka",
    Offset: "UTC+06:00"
  },
  {
    Timezone: "Novosibirsk",
    Offset: "UTC+06:00"
  },
  {
    Timezone: "Urumqi",
    Offset: "UTC+06:00"
  },
  {
    Timezone: "Rangoon",
    Offset: "UTC+06:30"
  },
  {
    Timezone: "Bangkok",
    Offset: "UTC+07:00"
  },
  {
    Timezone: "Hanoi",
    Offset: "UTC+07:00"
  },
  {
    Timezone: "Jakarta",
    Offset: "UTC+07:00"
  },
  {
    Timezone: "Krasnoyarsk",
    Offset: "UTC+07:00"
  },
  {
    Timezone: "Beijing",
    Offset: "UTC+08:00"
  },
  {
    Timezone: "Chongqing",
    Offset: "UTC+08:00"
  },
  {
    Timezone: "Hong Kong",
    Offset: "UTC+08:00"
  },
  {
    Timezone: "Irkutsk",
    Offset: "UTC+08:00"
  },
  {
    Timezone: "Kuala Lumpur",
    Offset: "UTC+08:00"
  },
  {
    Timezone: "Perth",
    Offset: "UTC+08:00"
  },
  {
    Timezone: "Singapore",
    Offset: "UTC+08:00"
  },
  {
    Timezone: "Taipei",
    Offset: "UTC+08:00"
  },
  {
    Timezone: "Ulaanbaatar",
    Offset: "UTC+08:00"
  },
  {
    Timezone: "Urumqi",
    Offset: "UTC+08:00"
  },
  {
    Timezone: "Osaka",
    Offset: "UTC+09:00"
  },
  {
    Timezone: "Sapporo",
    Offset: "UTC+09:00"
  },
  {
    Timezone: "Seoul",
    Offset: "UTC+09:00"
  },
  {
    Timezone: "Tokyo",
    Offset: "UTC+09:00"
  },
  {
    Timezone: "Yakutsk",
    Offset: "UTC+09:00"
  },
  {
    Timezone: "Adelaide",
    Offset: "UTC+09:30"
  },
  {
    Timezone: "Darwin",
    Offset: "UTC+09:30"
  },
  {
    Timezone: "Brisbane",
    Offset: "UTC+10:00"
  },
  {
    Timezone: "Canberra",
    Offset: "UTC+10:00"
  },
  {
    Timezone: "Guam",
    Offset: "UTC+10:00"
  },
  {
    Timezone: "Hobart",
    Offset: "UTC+10:00"
  },
  {
    Timezone: "Melbourne",
    Offset: "UTC+10:00"
  },
  {
    Timezone: "Port Moresby",
    Offset: "UTC+10:00"
  },
  {
    Timezone: "Magadan",
    Offset: "UTC+10:00"
  },
  {
    Timezone: "Solomon Is.",
    Offset: "UTC+10:00"
  },
  {
    Timezone: "Sydney",
    Offset: "UTC+10:00"
  },
  {
    Timezone: "Vladivostok",
    Offset: "UTC+10:00"
  },
  {
    Timezone: "New Caledonia",
    Offset: "UTC+11:00"
  },
  {
    Timezone: "Auckland",
    Offset: "UTC+12:00"
  },
  {
    Timezone: "Fiji",
    Offset: "UTC+12:00"
  },
  {
    Timezone: "Kamchatka",
    Offset: "UTC+12:00"
  },
  {
    Timezone: "Marshall Is.",
    Offset: "UTC+12:00"
  },
  {
    Timezone: "Wellington",
    Offset: "UTC+12:00"
  },
  {
    Timezone: "Nuku'alofa",
    Offset: "UTC+13:00"
  },
  {
    Timezone: "Samoa",
    Offset: "UTC+13:00"
  },
  {
    Timezone: "Tokelau Is.",
    Offset: "UTC+13:00"
  }
];

var agentstabloaded = false;
$(document).ready(function () {
  app.initialized().then(function (_client) {
    window.client = _client;
    client.events.on("app.activated", function () {
      initooo();
    });
  });
  initapply();
});

function initooo() {
  Promise.all([client.data.get("loggedInUser"), client.iparams.get(), getIparamDB()])
    .then(function (response) {
      console.log("res", response)
      if(response[2].ws_configurations) {
        window.workspaces = response[2].ws_configurations;
      }
      else {
        window.iparams = mergeJSON(response[1], response[2]);
      }
      // window.iparams = mergeJSON(response[1], response[2]);
      
      getAgentData(response[0].loggedInUser.user_id);
    })
    .catch(function (err) {
      showNotify("warning", "App is not initialized", err);
      console.log("Log: initooo -> err", err);
   });
}

function mergeJSON(json1, json2) {
  if (json2) {
    return $.extend(json1, json2);
  } else {
    return json1;
  }
}

function getAgentData(agent_id) {
  var req_path = `/api/v2/agents/${agent_id}`;
  return client.request.invokeTemplate("getRequestApiTemplate", { context: { path: req_path } }).then(function (agentData) {
    window.loggedInUser = JSON.parse(agentData.response).agent;
    setupooo(window.iparams);
  })
    .catch(function (error) {
      showNotify("warning", "Error", "Error getting agent data.");
      console.error(error);
    });
}

function getIparamDB() {
  return client.db
    .get("iparam") // this is just a key.
    .then()
    .catch(error => console.log(error));
}

function setupooo(data) {
  setlocaltimezone(data);
  forceUserToConfig();
  initAgentViewSwitch();
  var isAdmin = checkLoggedInUserCanSeeReport(window.loggedInUser, data);
  if (isAdmin) {
    $("#swithcadmin").trigger("click");
    initadminfeatures();
  } else {
    $('[data-view="agent"]').trigger("click");
    $('.switchtoagent').off("click");
    $(".returntoadmin").remove();
  }
  initdateFields();
  getooo();
  let filteredData = [];
  
  // let workspaceConfig = data['ws_configurations'];
  // workspaceConfig {2:{}, 3:{}}
  // let workspaceIds = Object.keys(workspaceConfig);
  for (const key in data) {
    if (key.startsWith('workspace_')) { // Sweta will change here.
      if (window.loggedInUser.workspace_ids.includes(data[key].workspaceId) && data[key].emailbody) {
        filteredData.push(data[key]);
      }
    }
  }
  if (filteredData.length >= 1) {
    const filteredWorkspaces = window.workspaces.filter(workspace =>
      filteredData.map(dataItem => dataItem.workspaceId === workspace.id)
    );
    console.log("filter", filteredData)
    console.log("filteredWorkspaces", )
    $("#froala-container").removeClass("hide");
    const generatedTemplate = displayWorkspaceEmails(filteredData, filteredWorkspaces);
    document.getElementById("froala-container").innerHTML = generatedTemplate;
  }
}

function setlocaltimezone(data) {
  try {
    var agentTimezone = window.loggedInUser.time_zone;
    var tz = data.timezone.find(x => x.Timezone === agentTimezone).Offset;
    luxon.Settings.defaultZoneName = tz;
  } catch (err) {
    console.log("Error ", err);
  }
}

function deleteleave() {
  $(".deleteleave").click(function () {
    var me = $(this);
    var agentid = window.loggedInUser.id;
    var filter = me.data("uuid");
    var leavestoDelete = window.agentleaves[filter];
    // get agent db, update the object, delete and recreate it.
    agentDbupdate(agentid, filter).finally(() => {
      // loop the date, and get the date db, update the object, delete and recreate it.
      dateDbupdate(
        luxon.DateTime.fromISO(leavestoDelete.fromdate),
        luxon.DateTime.fromISO(leavestoDelete.todate),
        agentid
      )
        .then(() => {
          getooo();
          showNotify("info", "Success", "Holiday removed from the list");
        })
        .catch(err => {
          console.log("Log: deleteleave -> err", err);
        });
    });
  });
}

function agentDbupdate(agentid, filter) {
  return new Promise((resolve, reject) => {
    client.db
      .get(agentid)
      .then(function (data) {
        var newdata = data.leaves.splice(0, filter);
        client.db
          .update(agentid, "set", {
            leaves: newdata
          })
          .then(
            function () {
              resolve();
            },
            function (error) {
              // failure operation
              showNotify("warning", "Error", "Not able to update the DB.");
              console.log(error);
              reject();
            }
          );
        console.log("Log: deleteleave -> data", data);
      })
      .catch(function (err) {
        console.error(err);
        reject();
      });
  });
}

function dateDbupdate(start, end, agentid) {
  return new Promise(resolve => {
    var diffInMonths = end.diff(start, "days");
    var diff = diffInMonths.toObject(); //=> { months: 1 }
    console.log("diff days " + JSON.stringify(diff));
    var diffdays = Math.ceil(diff.days) || 0;
    var promises = [];
    for (var i = 0; i <= diffdays; i++) {
      (function (i) {
        setTimeout(function () {
          promises.push(dateDbInit(i, start, agentid));
        }, 3000 * i);
      })(i);
    }
    Promise.all(promises).then(() => {
      resolve();
    });
  });
}

function dateDbInit(i, start, agentid) {
  return new Promise((resolve, reject) => {
    var date = start
      .setZone("UTC")
      .plus({ days: i })
      .toFormat("dd/LL/yyyy");
    client.db.get(date).then(data => {
      const filteredItems = data.agents.filter(function (item) {
        return item.agentid !== agentid;
      });
      client.db
        .update(date, "set", {
          agents: filteredItems
        })
        .then(
          function () {
            resolve();
          },
          function (error) {
            // failure operation
            showNotify("warning", "Error", "Not able to update the DB.");
            console.log(error);
            reject();
          }
        );
    });
  });
}

function forceUserToConfig() {
  console.log("params", window.iparams)
  // window.iparams.ws_configurations &&  window.iparams.ws_configurations.some((config) => config.validConfig))
  if (!Object.keys(window.iparams).some(key => key.startsWith('workspace_'))) {
    setTimeout(() => {
        $('[data-view="config"]').trigger("click");
        showNotify("info", "", "Please configure the OOO settings.");
    }, 100);
}
}

function getooo() {
  $(".ooohistory").html("");
  client.db
    .get(window.loggedInUser.id)
    .then(function (data) {
      var leaves = data.leaves;
      window.agentleaves = [];
      leaves.forEach(function (leave, index) {
        leave.uuid = index;
        window.agentleaves.push(leave);
        var from = luxon.DateTime.fromISO(leave.fromdate).toFormat(
          "d LLL yyyy"
        );
        var to = luxon.DateTime.fromISO(leave.todate).toFormat("d LLL yyyy");
        var whom = `<i title='Remove Leave' data-uuid="${index}" class="far fa-trash-alt deleteleave"></i>`;
        var diff = luxon.DateTime.fromISO(leave.todate)
          .diff(luxon.DateTime.fromISO(leave.fromdate), "days")
          .toObject();
        var leaves = Math.round(diff.days);
        var body = `<div class="col-sm-12 leave-card">
        <span class="dateofleave">${from} ${from === to ? "" : " - " + to
          }</span>
        <span class="bywhom">${whom}</span>
        <div class="pad10">
          <span class="leavedays">${leaves} ${leaves > 1 ? "days" : "day"
          }</span>
        </div>
        </div>`;
        $(".ooohistory").append(body);
      });
      deleteleave();
    })
    .catch(function (error) {
      if (error.status !== 404) {
        showNotify("warning", "Error", "Error fetching DB.");
      }
      console.log("Log: getooo -> error", error);
    });
}

function initadminfeatures() {
  // initRange();
  $('[data-view="config"]').removeClass("hide");
  initApplyOnBehalf();
  initcalendar();
}

function initcalendar() {
  $("#dtpicker").datetimepicker({
    minDate: moment().subtract(7, "days"),
    format: "DD/MM/YYYY",
    icons: {
      time: "far fa-clock",
      date: "far fa-calendar-alt",
      up: "fas fa-plus",
      down: "fas fa-minus",
      next: "fas fa-chevron-right",
      previous: "fas fa-chevron-left"
    }
  });
  $(".range").val(moment().format("DD-MMM-YYYY"));
  getdata(moment().format("DD-MMM-YYYY"));
  $(".dtpickerbtn").click(function () {
    $("#dtpicker")
      .data("DateTimePicker")
      .toggle();
  });
  $("#dtpicker").on("dp.change", function (e) {
    $(".noleaveondate").hide();
    playloader();
    if (e.date) {
      // $("#tableloader").removeClass("hide");
      $(".range").val(moment(e.date).format("DD-MMM-YYYY"));
      setTimeout(function () {
        getdata(e.date);
      }, 1000);
      // getdata(e.date);
    }
  });
}

function getdata(passeddate) {
  var date = luxon.DateTime.fromFormat(
    moment(passeddate).format("DD-MMM-YYYY"),
    "dd-LLL-yyyy"
  )
    .setZone(
      `${window.iparams.timezone.find(
        x => x.Timezone === window.loggedInUser.time_zone
      ).Offset
      }`
    )
    .setZone("UTC")
    .toFormat("dd/LL/yyyy");
  if (window.groupdata) {
    getselecteddate(date);
  } else {

    client.request.invokeTemplate("getRequestApiTemplate", { context: { path: '/api/v2/ticket_form_fields' } }).then(function (groupdata) {
      let ticketFields = JSON.parse(groupdata.response).ticket_fields;
      let defaultGroupObj = ticketFields.filter(el => el.field_type === "default_group");
      window.groupdata = defaultGroupObj[0].choices;
      getselecteddate(date);
    })
      .catch(function (error) {
        showNotify("warning", "Error", "Error getting ticket fields.");
        console.error(error);
      });
  }
}

function playloader() {
  $(".ooolisttable").show();
  $(".ooolisttable")
    .find("tr:gt(0)")
    .remove();
  var template = `<tr class="loading">
  <td>
    <span data-letters="N"></span>
    <div class="bar"></div>
  </td>
  <td><div class="bar"></div></td>
  <td><div class="bar"></div></td>
  </tr>`;
  for (var i = 0; i <= 10; i++) {
    $(".ooolisttable").append(template);
  }
}

function getselecteddate(date) {
  client.db
    .get(date)
    .then(function (data) {
      $(".ooolisttable ")
        .find("tr:gt(0)")
        .remove();
      if (data.agents.length > 0) {
        data.agents.forEach(agent => {
          var groupnames = [];
          var ss = "";
          console.log("agent", agent)
          if (agent.groupid) {
            agent.groupid.forEach(function (group) {
              let value = window.groupdata.find(item => item.id ===  group)?.value;
              groupnames.push(value);
            });
            ss = groupnames.map(i => " " + i).join(`,`);
          }
          var template = `<tr>
          <td>
            <span data-letters="${agent.name.charAt(0).toUpperCase()}">${agent.name}</span>
          </td>
          <td>${agent.email}</td>
          <td>${ss}</td>
        </tr>`;
          $(".ooolisttable").append(template);
        });
        $("#ooolisttable").show();
        $(".noleaveondate").hide();
      } else {
        $("#ooolisttable").hide();
        $(".noleaveondate").show();
      }
    })
    .catch(function (error) {
      console.log(error);
      $("#ooolisttable").hide();
      $(".noleaveondate").show();
    });
}

function initapply() {
  $(".agentapply").click(function () {
    createooo($("#datetimepicker1 input").val(), $("#datetimepicker2 input").val(), window.loggedInUser);
  });
}

function createooo(startTime, endTime, agentinfo, self = true) {
  if (!startTime && !endTime) {
    showNotify(
      "error",
      "Invalid",
      "Please fill the date fileds to apply leave."
    );
    return false;
  }
  var start = luxon.DateTime.fromFormat(startTime, "dd/LL/yyyy");
  var end = luxon.DateTime.fromFormat(endTime, "dd/LL/yyyy");
  // check if agent has already applied leave on these days.
  validateleave(agentinfo.id, startTime, endTime)
    .then(function () {
      var diffInMonths = end.diff(start, "days");
      var diff = diffInMonths.toObject(); //=> { months: 1 }
      var diffdays = diff.days || 0;
      for (var i = 0; i <= diffdays; i++) {
        var date = luxon.DateTime.fromFormat(startTime, "dd/LL/yyyy")
          .setZone("UTC")
          .plus({ days: i })
          .toFormat("dd/LL/yyyy");
        var obj = {
          agentid: agentinfo.id,
          name: agentinfo.first_name,
          email: agentinfo.email,
          groupid: agentinfo.group_ids
        };
        setTimeout(saveinformationindb(date, obj), 1000);
      }
      setTimeout(saveagentinfodb(startTime, endTime, agentinfo.id), 2000);
      if (self) {
        setTimeout(getooo, 2000);
      }
      // Save the data and show a notification
      showNotify("success", "Success", "Out Of Office information saved successfully.");
      $("#messagediv").addClass("hide");
      clearDateFields();
    })
    .catch(function () {
      showNotify("info", "Not Saved", "Agent already applied leave for selected day/s");
      clearDateFields();
    });
}

function doesOverlap(e1, e2) {
  var e1start = new Date(e1.start).getTime();
  var e1end = new Date(e1.end).getTime();
  var e2start = new Date(e2.start).getTime();
  var e2end = new Date(e2.end).getTime();

  return (e1start >= e2start && e1start < e2end) || (e2start > e1start && e2start < e1end);
}

function validateleave(agentid, start, end) {
  var localstart = luxon.DateTime.fromFormat(
    start + " 00:00:00",
    "dd/LL/yyyy HH:mm:ss"
  )
    .startOf("day")
    .setZone("utc")
    .toISO();
  var localend = luxon.DateTime.fromFormat(
    end + " 00:00:00",
    "dd/LL/yyyy HH:mm:ss"
  )
    .endOf("day")
    .setZone("utc")
    .toISO();
  var e1 = {
    start: localstart,
    end: localend
  };
  var isoverlap = false;
  return Promise.resolve().then(function () {
    return client.db
      .get(agentid)
      .then(function (data) {
        data.leaves.forEach(function (leave) {
          var e2 = {
            start: leave.fromdate,
            end: leave.todate
          };
          if (!isoverlap) {
            isoverlap = doesOverlap(e1, e2);
          }
        });
        if (isoverlap) {
          throw data;
        } else {
          throw {};
        }
      })
      .catch(function (error) {
        if (error.leaves) {
          throw error;
        } else {
          return true;
        }
      });
  });
}

function saveinformationindb(date, obj) {
  client.db.get(date).then(
    function () {
      // update
      client.db.update(date, "append", { agents: [obj] }).then(
        function () {
          console.log("success in saving data");
        },
        function (error) {
          showNotify("warning", "Error", "Not able to update leave data in the DB.");
          console.log(error);
        }
      );
    },
    function (error) {
      console.log(error);
      // create the data
      client.db.set(date, { agents: [obj] }).then(
        function () {
          console.log("success in saving data");
        },
        function (error) {
          // failure operation
          showNotify("warning", "Error", "Not able to create leave data in the DB.");
          console.log(error);
        }
      );
    }
  );
}

function saveagentinfodb(start, end, agentid) {
  // find offset
  var localstart = luxon.DateTime.fromFormat(
    start + " 00:00:00",
    "dd/LL/yyyy HH:mm:ss"
  );
  var localend = luxon.DateTime.fromFormat(
    end + " 00:00:00",
    "dd/LL/yyyy HH:mm:ss"
  );
  var obj = {
    fromdate: localstart
      .startOf("day")
      .setZone("utc")
      .toISO(),
    todate: localend
      .endOf("day")
      .setZone("utc")
      .toISO(),
    email: $("#apply-ooo-froala-editor").froalaEditor("html.get")
  };
  client.db.get(agentid).then(
    function () {
      // update
      client.db.update(agentid, "append", { leaves: [obj] }).then(
        function (data) {
          console.log("Log: saveagentinfodb -> data", data);
        },
        function (error) {
          // failure operation
          showNotify("warning", "Error", "Not able to update agent info in the DB.");
          console.log(error);
        }
      );
    },
    function (error) {
      console.log(error);
      // create the data
      client.db.set(agentid, { leaves: [obj] }).then(
        function (data) {
          console.log("Log: saveagentinfodb -> data", data);
          // success operation
          // "data" value is { "Updated" : true}
        },
        function (error) {
          showNotify("warning", "Error", "Not able to update agent infor in the DB.");
          console.log(error);
        }
      );
    }
  );
}

function checkLoggedInUserCanSeeReport(loggedInUser, iparams) {
  var rtnval = false;
  try {
    var isRoleAPI = iparams.roleAPI;
    var adminRoles = iparams.allowreportsfor || [];
    var loggedInUserRoles = loggedInUser.roles;
    var role_ids = []
    loggedInUserRoles.forEach(function (role) {
      role_ids.push(role.role_id);
    });
    adminRoles.forEach(element => {
      if (!rtnval) {
        if (isRoleAPI == true)
          rtnval = role_ids.includes(element);
        else
          rtnval = (loggedInUser.email == element);
      }
    });
  } catch (err) {
    console.error(err);
  }
  return rtnval;
}

function initdateFields() {
  $("#datetimepicker1").datetimepicker({
    minDate: moment().startOf('day'),
    format: "DD/MM/YYYY",
    icons: {
      time: "far fa-clock",
      date: "far fa-calendar-alt",
      up: "fas fa-plus",
      down: "fas fa-minus",
      next: "fas fa-chevron-right",
      previous: "fas fa-chevron-left"
    }
  });
  $("#datetimepicker2").datetimepicker({
    minDate: moment().add(0, "days"),
    useCurrent: false,
    format: "DD/MM/YYYY",
    icons: {
      time: "far fa-clock",
      date: "far fa-calendar-alt",
      up: "fas fa-plus",
      down: "fas fa-minus",
      next: "fas fa-chevron-right",
      previous: "fas fa-chevron-left"
    }
  });
  $("#datetimepicker1").on("dp.change", function (e) {
    if (e.date) {
      $("#datetimepicker2").data("DateTimePicker").minDate(e.date);
      var fromDate = moment(e.date);
      var toDate = moment($("#datetimepicker2").data("DateTimePicker").date());
      var diffInDays = toDate.diff(fromDate, 'days');

      if (diffInDays > 15) {
        toDate = fromDate.clone().add(15, 'days');
        $("#datetimepicker2").data("DateTimePicker").date(toDate);
      }
    }
  });

  $("#datetimepicker2").on("dp.show", function () {
    var fromDate = moment($("#datetimepicker1").data("DateTimePicker").date());
    var maxDate = fromDate.clone().add(15, 'days');
    $(this).data("DateTimePicker").maxDate(maxDate);
  });
}

function initfroala(workspaceId) {
  var selector = `#apply-ooo-froala-editor-${workspaceId}`;
  var a = ["bold", "italic", "underline", "|", "fontFamily", "fontSize", "color", "align", "|", "formatOL", "formatUL", "|", "insertLink", "|", "spellChecker", "specialCharacters", "|", "clearFormatting"];
  var i = [
    "#61BD6D",
    "#1ABC9C",
    "#54ACD2",
    "#2C82C9",
    "#9365B8",
    "#475577",
    "#00A885",
    "#3D8EB9",
    "#2969B0",
    "#553982",
    "#28324E",
    "#000000",
    "#F7DA64",
    "#FBA026",
    "#EB6B56",
    "#E25041",
    "#A38F84",
    "#FFFFFF",
    "#FAC51C",
    "#F37934",
    "#B8312F",
    "#7C706B",
    "#D1D5D8",
    "REMOVE"
  ];
  var o = {
    charCounterCount: !1,
    quickInsertButtons: !1,
    editorClass: "ticket-note-typography",
    key: "Qg1Ti1LXd2URVJh1DWXG==",
    toolbarBottom: !1,
    imageMove: !1,
    // imageInsertButtons:["imageByURL"],
    imageInsertButtons: ["imageBack", "|", "imageByURL"],
    linkInsertButtons: ["linkBack"],
    linkEditButtons: ["linkOpen", "linkEdit", "linkRemove"],
    toolbarButtons: a,
    imageDefaultAlign: "left",
    focusOnMarker: !0,
    toolbarButtonsSM: a,
    toolbarButtonsXS: a,
    colorsBackground: i,
    colorsText: i,
    colorsStep: 6,
    imageUploadRemoteUrls: false,
    // imageUpload: false,
    imagePaste: true,
    htmlUntouched: true,
    useClasses: false,
    pluginsEnabled: ["image", "link", "draggable", "codeView", "list", "colors", "align", "fontFamily", "fontSize", "lineBreaker", "specialCharacters", "table", "url", "spellChecker"]
  };
  // $(selector).froalaEditor(o);
  $(selector)
    .on("froalaEditor.initialized", function () {
      console.log("editor initialized");
    })
    .on("froalaEditor.focus", function (e, editor) {
      console.log("Log: initfroala -> e", e);
      console.log("Log: initfroala -> editor", editor);
    })
    .froalaEditor(o);
}

function toggleEditor(method, workspaceId) {
  $("#apply-ooo-froala-editor-" + workspaceId).froalaEditor(method);
}

function initApplyOnBehalf() {
  $(".applyforagent").click(function () {
    initApplyForAgent();
  });
}

function initAgentViewSwitch() {
  $(".switchtoagent").click(function () {
    $(this).parents("ul.menu").find("a").removeClass("active");
    $(this).addClass("active");
    $(".tab-container").addClass("hide");
    var switchto = $(this).data("view");
    getIparamfromDb();
    $(".view")
      .removeClass("hide")
      .addClass("hide");
    if (switchto === "config") {
      $("#loading").removeClass("hide");
      showLvl2Config();
      setTimeout(() => {
        $("#loading").addClass("hide");
        $(`#${switchto}view`).removeClass("hide");
      }, 2500);
    } else {
      $(`#${switchto}view`).removeClass("hide");
    }
    $(".tab-container").removeClass("hide");
  });
}

function showNotify(type, title, message) {
  client.interface
    .trigger("showNotify", {
      type: type,
      title: title,
      message: message
    })
    .then(function (data) {
      console.log("Log: showNotify -> data", data);
      // data - success message
    })
    .catch(function (error) {
      console.log("Log: showNotify -> error", error);
      // error - error object
    });
}

function clearDateFields() {
  $(".input-group input").val("");
}

String.prototype.replaceAll = function (search, replacement) {
  var target = this;
  return target.replace(new RegExp(search, "g"), replacement);
};

function initApplyForAgent() {
  initsend();
  initautocomplete();
  initdateFieldsafa();
}

function initdateFieldsafa() {
  $("#datetimepicker1afa").datetimepicker({
    minDate: moment().startOf('day'),
    format: "DD/MM/YYYY",
    icons: {
      time: "far fa-clock",
      date: "far fa-calendar-alt",
      up: "fas fa-plus",
      down: "fas fa-minus",
      next: "fas fa-chevron-right",
      previous: "fas fa-chevron-left"
    }
  });
  $("#datetimepicker2afa").datetimepicker({
    minDate: moment().add(0, "days"),
    useCurrent: false,
    format: "DD/MM/YYYY",
    icons: {
      time: "far fa-clock",
      date: "far fa-calendar-alt",
      up: "fas fa-plus",
      down: "fas fa-minus",
      next: "fas fa-chevron-right",
      previous: "fas fa-chevron-left"
    }
  });
  $("#datetimepicker1afa").on("dp.change", function (e) {
    if (e.date) {
      $("#datetimepicker2afa").data("DateTimePicker").minDate(e.date);
      var fromDate = moment(e.date);
      var toDate = moment($("#datetimepicker2afa").data("DateTimePicker").date());
      var diffInDays = toDate.diff(fromDate, 'days');

      if (diffInDays > 15) {
        toDate = fromDate.clone().add(15, 'days');
        $("#datetimepicker2afa").data("DateTimePicker").date(toDate);
      }
    }
  });

  $("#datetimepicker2afa").on("dp.show", function () {
    var fromDate = moment($("#datetimepicker1afa").data("DateTimePicker").date());
    var maxDate = fromDate.clone().add(15, 'days');
    $(this).data("DateTimePicker").maxDate(maxDate);
  });
}

function initsend() {
  $("#messagediv").addClass("hide");
  $("#save").click(function () {
    if ($("#agentid").val() === "" || $("#datetimepicker1afa input").val() === "" || $("#datetimepicker2afa input").val() === "") {
      $("#messagediv").removeClass("hide");
      return false;
    } else {
      var obj = {
        agentid: $("#agentid").val(),
        from: $("#datetimepicker1afa input").val(),
        to: $("#datetimepicker2afa input").val()
      };
      var req_path = `/api/v2/agents/${obj.agentid}`;
      client.request.invokeTemplate("getRequestApiTemplate", { context: { path: req_path } }).then(function (data) {
        createooo(obj.from, obj.to, JSON.parse(data.response).agent, false);
      })
        .catch(function (error) {
          console.log(error);
          showNotify("error", "Agent Details", "Getting agent info failed");
        });


    }
  });
}

function initautocomplete() {
  $(".searchinput")
    .autocomplete({
      select: function (event, ui) {
        $("#agentid").val(ui.item.agentid);
      },
      source: function (request, response) {
        $("#searchicon")
          .removeClass("fa-search")
          .addClass("fa-spinner fa-spin");
        let workspace_ids = window.loggedInUser.workspace_ids;
        var req_path = `/search/autocomplete/itil_agents.json?term=${request.term}&workspace_ids=${workspace_ids}`
        client.request.invokeTemplate("getRequestApiTemplate", { context: { path: req_path } }).then(function (data) {
          $("#searchicon")
            .removeClass("fa-spinner fa-spin")
            .addClass("fa-search");
          response(
            $.map(JSON.parse(data.response).results, function (item) {
              return {
                label: item.value,
                value: item.value,
                email: item.email,
                agentid: item.id
              };
            })
          );
        },
          function (error) {
            $("#searchicon")
              .removeClass("fa-spinner fa-spin")
              .addClass("fa-search");
            response(error);
          }
        );
      }
    })
    .autocomplete("instance")._renderItem = function (ul, item) {
      return $("<li>")
        .append("<div class='result-row'>" + item.label + "<br><span>" + item.email + "</span></div>")
        .appendTo(ul);
    };
}

function toggleConfigurations(workspaceId) {
  const configurationSection = document.getElementById(`emailContainer-${workspaceId}`);
  const row = document.getElementById(`apply-ooo-row-${workspaceId}`);
  const arrow = document.getElementById(`apply-ooo-arrow-${workspaceId}`);

  if (configurationSection.style.display === 'none') {
    //show
    configurationSection.style.display = 'block';
    row.style.backgroundColor = 'hsl(207, 57%, 81%)';
    arrow.style.transform = 'rotate(45deg)';
    arrow.style.marginTop = '3px';

    // cslose others
    const allSections = document.querySelectorAll('.email-configuration');
    allSections.forEach(section => {
      if (section.id !== `emailContainer-${workspaceId}`) {
        section.style.display = 'none';
        const rowId = section.id.replace('emailContainer-', 'apply-ooo-row-');
        const otherRow = document.getElementById(rowId);
        if (otherRow) {
          otherRow.style.backgroundColor = 'hsl(204, 4%, 74%)';
          const otherArrow = document.getElementById(`apply-ooo-arrow-${section.id.replace('emailContainer-', '')}`);
          if (otherArrow) {
            otherArrow.style.transform = 'rotate(225deg)';
            otherArrow.style.marginTop = '6px';
          }
        }
      }
    });
  } else {
    //hide section
    configurationSection.style.display = 'none';
    row.style.backgroundColor = 'hsl(204, 4%, 74%)';
    arrow.style.transform = 'rotate(225deg)';
    arrow.style.marginTop = '6px';
  }
}




function displayWorkspaceEmails(filteredData, filteredWorkspaces) {
console.log("filteredData", filteredData)
console.log("filteredWorkspaces", filteredWorkspaces)
  let commonTemplate = (workspaceData) => `
  <tr class="email-configuration" id="emailContainer-${workspaceData.id}" style="display: ${workspaceData.primary ? 'block' : 'none'};">
    <td style="padding: 0px;">
      <span class="form-label"> OOO notification to customer</span>
      <div id="apply-ooo-froala-editor-${workspaceData.id}" style="width: 940px; padding-top:4px"></div>
      <span id="askadminforeditaccess-${workspaceData.id}">
        <i class="fas fa-info-circle"></i>
        Request admin for edit access
      </span>
    </td>
  </tr>`;

  if (filteredData.length === 1) {
    return commonTemplate(filteredWorkspaces[0]);
  } else {
    let template = "";
    filteredWorkspaces.forEach((workspace, index) => {
      template += `
        <table>
          <tr id="apply-ooo-row-${workspace.id}" class="table-row col-sm-7" style="background-color: ${workspace.primary ? 'hsl(207, 57%, 81%)' : 'hsl(204, 4%, 74%)'}">
            <td class="semi-bold">
              <div class="circle" id="apply-ooo-blueCircle-${workspace.id}" onclick="toggleConfigurations(${workspace.id})">
                <i id="apply-ooo-arrow-${workspace.id}" class="arrow" style="${workspace.primary ? 'transform: rotate(45deg); margin-top: 3px;' : '6px'}"></i>
              </div>
              ${workspace.name}<span>${workspace.primary ? '(Primary)' : ''}</span>
            </td>
          </tr>
          ${commonTemplate(workspace)}
        </table>`;
      $(document).ready(function () {
        initfroala(workspace.id);
        console.log("workspaceId", workspace.id)
        console.log("email", filteredData[index].emailbody)
        let email = filteredData[index].emailbody? filteredData[index].emailbody : "";
        $("#apply-ooo-froala-editor-" + workspace.id).froalaEditor("html.set", email);
        if (!filteredData[index].canagenteditemail) {
          toggleEditor("edit.off", workspace.id);
          $(".fr-toolbar.fr-disabled").hide();
          $("#askadminforeditaccess-" + workspace.id).show();
        }

      });

    });
    return template;
  }
}
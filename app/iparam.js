var savedConfig = null;
var installed = false;
var client, domain, api_key;
var iparamCached = false;
var cachedIparam = {};

function showLvl2() {
  getGroups();
  getAgents();
  $("#iparams-lvl1").hide();
  $("#iparams-lvl2").show();
  $("#domain-apikey").hide();
  initsaveIparams();
  setTimeout(function() {
    getIparamfromDb();
  }, 2000);
}

function IsValidJSONString(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

function initiparamfroala() {
  var selector = "#emailbody-content";
  var a = ["bold", "italic", "underline", "|", "fontFamily", "fontSize", "color", "align", "|", "formatOL", "formatUL", "|", "insertLink", "insertImage", "|", "spellChecker", "|", "clearFormatting"];
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
    height: 200,
    pluginsEnabled: ["image", "link", "draggable", "codeView", "list", "colors", "align", "fontFamily", "fontSize", "lineBreaker", "specialCharacters", "table", "url", "spellChecker"]
  };
  // $(selector).froalaEditor(o);
  $(selector)
    .on("froalaEditor.initialized", function() {
      console.log("editor initializec");
    })
    .on("froalaEditor.contentChanged", function() {
      // Des
    })
    .on("froalaEditor.focus", function() {
      // Des
    })
    .froalaEditor(o);
}

function insertPlaceholder(t) {
  var placeholder;
  var dict = {
    agentname: "ticket.agent.name",
    agentemail: "ticket.agent.email",
    requestername: "ticket.requester.name",
    ticketurl: "ticket.url"
  };
  placeholder = dict[t];
  $("#emailbody-content").froalaEditor("html.insert", "{{" + placeholder + "}}", true);
}

$(function() {
  initiparamfroala();
  $("#sendooonotification").change(function() {
    if ($(this).is(":checked")) {
      $("#oooresponse").css("max-height", "400px");
      $(this)
        .closest(".row.pad20")
        .find(".inner")
        .css("height", "405px");
    } else {
      $("#oooresponse").css("max-height", "0");
      $(this)
        .closest(".row.pad20")
        .find(".inner")
        .css("height", "1%");
    }
  });
  $("#reassigntickettogroup").change(function() {
    if ($(this).is(":checked")) {
      $("#reassign").css("max-height", "500px");
      $(this)
        .closest(".row.pad20")
        .find(".inner")
        .css("height", "175px");
      $("#unassignticket")
        .prop("checked", false)
        .trigger("change");
    } else {
      $("#reassign").css("max-height", "0");
      $(this)
        .closest(".row.pad20")
        .find(".inner")
        .css("height", "0");
    }
  });
  $("#unassignticket").change(function() {
    if ($(this).is(":checked")) {
      $("#reassigntickettogroup")
        .prop("checked", false)
        .trigger("change");
    }
  });
});

function getGroups() {
  var req_path = '/api/v2/groups?per_page=100';
  client.request.invokeTemplate("getRequestApiTemplate", { context: { path: req_path } }).then(function(groupData) {
    var groupsData =JSON.parse(groupData.response).groups
    $.each(groupsData, function(key, value) {
      $("#groups").append(
        $("<option></option>")
        .attr("value", value.id)
        .attr("selected", value === 0 ? true : false)
        .text(value.name)
      );
    });
    if (installed) {
        $("#groups").val(savedConfig.assignedgroup);
      }
      $("#groups").select2({
        width: "resolve" // need to override the changed default
      });
    })
    .catch(function(err) {
      showNotify("warning", "Error", "Error while getting the Groups new");
      console.log("Log: getGroups -> err", err);
  });
}

function getAgents() {
  var req_path = '/api/v2/ticket_fields?type=default_agent';
  client.request.invokeTemplate("getRequestApiTemplate", { context: { path: req_path } }).then(function(agentData) {
    var ticketFieldsData = JSON.parse(agentData.response).ticket_fields
    $("#agents").empty();
    $("#agents").append("<option value='-1' selected='selected'>--</option>");
    $.each(Object.entries(ticketFieldsData[0].choices), function(key, value) {
      $("#agents").append(
        $("<option></option>")
        .attr("value", value[1])
        .attr("selected", value === 0 ? true : false)
        .text(value[0])
      );
    });
    if (installed) {
      $("#agents").val(savedConfig.assignedagent);
    }
    $("#agents").select2({
      width: "resolve" // need to override the changed default
    });
  })
  .catch(function(err) {
    showNotify("warning", "Error", "Error while getting agent details new");
    console.log("Log: getGroups -> err", err);
  });
}

function displayIparamData(config){
  $("#emailbody-content").froalaEditor("html.set", config.emailbody);
    $("#allowagenedit")
      .attr("checked", config.canagenteditemail)
      .trigger("change");
    $("#sendooonotification")
      .attr("checked", config.sendooonotification)
      .trigger("change");
    $("#froala-container").toggleClass("hide", !config.sendooonotification);
    $("#reassigntickettogroup")
      .attr("checked", config.reassigntickettogroup)
      .trigger("change");
    $("#unassignticket")
      .attr("checked", config.unassignticket)
      .trigger("change");
    $("#agents")
      .val(config.assignedagent)
      .trigger("change");
    $("#groups")
      .val(config.assignedgroup)
      .trigger("change");
}

function getIparamfromDb() {
  if (iparamCached == true){
    displayIparamData(cachedIparam);
  } else {
    client.db.get("iparam").then(function(config) {
    //  iparamCached = true;
     cachedIparam = config;
     displayIparamData(cachedIparam);
    },function() {
      // failure operation
      console.log("Error - while fetching the configuration");
    });
  }
}

function initsaveIparams() {
  $("#saveIparam").unbind();
  $("#saveIparam").click(function() {
    if ($("#sendooonotification").is(":checked") && $("#emailbody-content").froalaEditor("html.get") == "" && !$("#allowagenedit").is(":checked")){
       showNotify("error", "Invalid", "Email body cannot be empty when 'Allow agent to edit the notification' is not selected");
    } else if (validateIparam()) {
      var obj = {
        validconfig: true,
        sendooonotification: $("#sendooonotification").is(":checked"),
        reassigntickettogroup: $("#reassigntickettogroup").is(":checked"),
        unassignticket: $("#unassignticket").is(":checked"),
        emailbody: $("#emailbody-content").froalaEditor("html.get"),
        canagenteditemail: $("#allowagenedit").is(":checked"),
        assignedgroup: $("#groups").val(),
        assignedagent: $("#agents").val()
      };
      saveiparamindb("iparam", obj);
    } else {
      showNotify("error", "Invalid", "Please enable atleast one configuration");
    }
  });
}

function validateIparam() {
  var enabledOperations = $("input[type='checkbox'].ios8-switch:checked").length;
  return enabledOperations > 0
}

function saveiparamindb(name, obj) {
  client.db.set(name, obj).then(
    function() {
      showNotify("success", "Successful", "Configuration Saved");
    },
    function() {
      // failure operation
      showNotify("error", "Not Saved", "Something went wrong!");
    }
  );
}

/**
 * manages a cartodb permission object, it contains:
 * - owner: an cdb.admin.User instance
 * - acl: a collection which includes the user and their permission.
 *
 *   see https://github.com/Vizzuality/cartodb-management/wiki/multiuser-REST-API#permissions-object
 *
 *   this object is not created to work alone, it should be a member of an object like visualization
 *   table
 */
cdb.admin.Permission = cdb.core.Model.extend({


  urlRoot: '/api/v1/perm',

  initialize: function() {
    this.acl = new Backbone.Collection();
    this.owner = null;
    if (this.get('owner')) {
      this.owner = new cdb.admin.User(this.get('owner'));
    }

    if (this.get('acl')) {
      var acl = this.get('acl');
      for (var i = 0; i < acl.length; ++i) {
        var aclitem = acl[i];
        if (aclitem.type === 'user') {
          this.setPermission(new cdb.admin.User(aclitem.entity), aclitem.access);
        } else {
          // org
          var org = new cdb.admin.Organization(aclitem.entity);
          this.setPermission(org, aclitem.access);
        }
      }
    }
  },

  // remove permissions for an user
  // or a users collection.
  removePermission: function(users) {
    var self = this;

    if (!users) {
      throw new Error("can't remove permission, users undefined");
    }

    // Convert into array if it isn't.
    users = _.isArray(users) ? users.slice() : [users];

    // Check organization item can't be in the same array with a users item
    var isOrgAndUser = users.length > 1 && _.find(users, function(i) { return !i instanceof cdb.admin.User });
    if (isOrgAndUser) {
      throw new Error("can't remove permission for a user and organization at the same time");
    }

    // If model is user type and there is an organization,
    // remove organization from acl and set user permissions
    // from organization
    var isOrg = _.find(users, function(i) { return !i instanceof cdb.admin.User }) > 0;
    var aclOrg = this.acl.find(function(i) { return i.get('type') === "org" });

    if (!isOrg && aclOrg) {
      // Org perm
      var perm = aclOrg.get('access');
      var org_users = aclOrg.get('entity').users;

      // Remove organization
      this.acl.remove(aclOrg);

      // Add permission from organization to
      // rest of users, but not for the current-one
      org_users.each(function(u) {
        if (_.contains(users, u)) {
          self.setPermission(u, access);
        } else {
          self.setPermission(u, perm);
        }
      });

    } else {
      // Else, remove that permission
      _.each(users, function(u){
        self.removePermission(u);
      });
    }
  },

  // Empty the acl collection
  cleanPermissions: function() {
    this.acl.reset();
  },

  // Create a new ACLItem
  // - Private method
  _createACLItem: function(u, access) {
    if (u instanceof cdb.admin.User) {
      return new cdb.admin.ACLItem({ type: 'user', entity: u, access: access});
    }
    return new cdb.admin.ACLItem({ type: 'org', entity: u, access: access});
  },

  // adds/sets permissions for an user
  // or a user collection.
  // access can take the folowing values: 
  // - 'r': read only
  // - 'rw': read and write permission
  setPermission: function(users, access) {
    var self = this;

    if (!users) {
      throw new Error("can't remove permission, user undefined");
    }

    // Convert into array if it isn't.
    users = _.isArray(users) ? users.slice() : [users];

    // Check organization item can't be in the same array with a user item
    var isOrgAndUser = users.length > 1 && _.find(users, function(i) { return i instanceof cdb.admin.User === false });
    if (isOrgAndUser) {
      throw new Error("can't change permission for a user and organization at the same time");
    }
    
    var org = _.find(users, function(i) { return i instanceof cdb.admin.User === false });

    if (!org) {
      // If action is for a user
      
      // - Create or set perm
      _.each(users, function(u){
        var aclItem = self._accessForUser(u);
        if (aclItem && aclItem.get('entity').id === u.id) {
          aclItem.set('access', access);
        } else {
          aclItem = self._createACLItem(u, access);
          if (!aclItem.isValid()) throw new Error("invalid acl");
          self.acl.add(aclItem);
        }
      });

      // - Get organization permission
      var acl_org = this.acl.find(function(i) { return i.get('type') === "org" });

      if (acl_org) {
        // If users have the same value
        // - if so, organization permission removed and set same for rest of users
        
        var users_size = acl_org.get('entity').users.size();
        var usersSameValue = this.acl.filter(function(i) { return i.get('type') === "user" && i.get('access') === access }).length === users_size;

        if (usersSameValue) {
          var entity = acl_org.get('entity');

          this.acl.each(function(i) {
            if (i.get('type') === "user") {
              self.acl.remove(i)
            } else {
              i.set('access', access);
            }
          });
        } else {
          var org_users = acl_org.get('entity').users;
          var perm = acl_org.get('access');

          org_users.each(function(u){
            var aclItem = self._accessForUser(u);
            if (!aclItem) {
              aclItem = self._createACLItem(u, perm);
              if (!aclItem.isValid()) throw new Error("invalid acl");
              self.acl.add(aclItem);
            }
          });

          this.acl.remove(acl_org);
        }

      }

    } else {
      // If action if for an organization
      
      // - Remove all org users permission
      this.acl.reset([],{ silent: true });

      // - Set organization permission
      _.each(users, function(u){
        var aclItem = self._accessForUser(u);
        if (aclItem && aclItem.get('entity').id === u.id) {
          aclItem.set('access', access);
        } else {
          aclItem = self._createACLItem(u, access);
          if (!aclItem.isValid()) throw new Error("invalid acl");
          self.acl.add(aclItem);
        }
      });
    }
  },

  _accessForUser : function(user) {
    if (!user) {
      throw new Error("user");
    }
    return this.acl.find(function(u) {
      return u.get('entity').id === user.id;
    });
  },

  

  // return permissions for an user or organization,
  // null if the user is not un the acl
  getPermission: function(user) {
    if (!user) {
      throw new Error("user");
    }

    var aclItem = this._accessForUser(user);
    if (aclItem) {
      return aclItem.get('access');
    } else {
      // get permissions for org
      var orgAcl = _.find(this.acl.where({
        type: 'org'
      }), function(org) {
        return org.get('entity').containsUser(user);
      });
      if (orgAcl) {
        return orgAcl.get('access');
      }
    }
    return null;
  },

  // Check if user is the owner of this permission
  isOwner: function(user) {
    if (!user) {
      throw new Error("user");
    }

    return this.owner.get('id') === user.get('id');
  },

  toJSON: function() {
    return {
      entity: this.get('entity'),
      acl: this.acl.toJSON()
    };
  }

}, {

  READ_ONLY: 'r',
  READ_WRITE: 'rw',
  NONE: 'n',

});

//TODO: add validation
cdb.admin.ACLItem = Backbone.Model.extend({
  defaults: {
    access: 'r'
  },

  validate: function(attrs, options) {
    var p = cdb.admin.Permission;
    if (attrs.access !== p.READ_ONLY && attrs.access !== p.READ_WRITE && attrs.access !== p.NONE) {
      return "access can't take 'r', 'rw' or 'n' values";
    }
  },

  toJSON: function() {
    return {
      type: this.get('type') || 'user',
      entity: _.pick(this.get('entity').toJSON(), 'id', 'username'),
      access: this.get('access')
    };
  }
});
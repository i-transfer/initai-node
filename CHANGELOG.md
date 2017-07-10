# 0.0.14 / 2017-07-10

* Introduce `addSuggestion` method
* Introduce `sendResult` method
* Introduce [Prettier](https://prettier.github.io/prettier)

# 0.0.13 / 2017-05-27

* Fix an issue where `expect` would not clear previous expectations
  * Update `expect` to use new `updateConversationState` calling conventions

# 0.0.12 / 2017-04-26

* Update README to include new platform features

# 0.0.11 / 2017-02-01

* Restrict update strategies in `updateUser` method
  * Add deprecation logging for keypath and object literal merges
  * Add log warning for immutable keys that will not be persisted

# 0.0.10 / 2017-01-27

* Support sending quick replies
  * Add `addResponseWithReplies` which sends a templated message with quick replies
  * Add `makeReplyButton` to create a quick reply structure

# 0.0.9 / 2016-12-01

* Add `getEnvironment` method
* Add deprecation warning to `getCurrentApplicationEnvironment` method

# 0.0.8 / 2016-11-22

* Improve error messaging when MessagePart is not passed to entity helper methods
* Add `resetConversationState` method
  * See [docs](https://docs.init.ai/docs/client-api-methods#section-resetconversationState)
* Fix broken docs links in `getEntities` and `getFirstEntityWithRole` error output

# 0.0.7 / 2016-11-14

* Add initial support for processing messages based on participant role
* Allow un-prefixed response template names in `addResponse` method

# 0.0.6 / 2016-10-24

* Configure build for `initai-node` release

# 0.0.5 / 2016-10-24

* Add entity helper methods
  * `getFirstEntityWithRole`
  * `getEntities`

# 0.0.4 / 2016-09-08

* After a substream (referenced by stream name in a list of steps) terminates, the orignal stream is resumed
* Handle image type messages
* Track stream stack with expectations to resume orignal streams
* Support '/reset' to reset users
* Fix improper checking of length of stream

# 0.0.3 / 2016-08-25

* Introduce package-named prefixes for internal logs

# 0.0.2 / 2016-08-12

* Cleanup package.json

# 0.0.1 / 2016-08-12

* Initial release
